import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  DomainOrderKind,
  DomainOrderStatus,
  DomainStatus,
  DomainType,
  Prisma,
  TenantRole,
} from '@prisma/client';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { AuditService } from '../audit/audit.service';
import { AuthorizationService } from '../authorization/authorization.service';
import { prepareWalletPayment } from '../billing/billing-payments.service';
import { DomainEdgeQueueService } from '../domains/domain-edge-queue.service';
import { StoreDomainResolver } from '../domains/store-domain.resolver';
import {
  DOMAIN_REGISTRAR,
  RegistrarError,
  type DomainAvailability,
  type DomainRegistrar,
  type RegistrantContact,
} from './dynadot.client';
import {
  DOMAIN_SALES_SETTINGS_KEY,
  isSellableDomain,
  loadDomainSalesSettings,
  parseDomainQuery,
  readDomainSalesSettings,
  yearlyPriceBdt,
  type DomainSalesSettings,
} from './domain-sales-settings';
import type { CreateDomainOrderDto, RegistrantDto, RenewDomainDto } from './dto/domain-sales.dto';

const SEARCH_CACHE_SECONDS = 600;
const ORDER_INCLUDE = {
  tenant: { select: { id: true, name: true, slug: true } },
  store: { select: { id: true, name: true, slug: true } },
  submittedBy: { select: { email: true, firstName: true, lastName: true } },
  reviewedBy: { select: { email: true } },
} satisfies Prisma.DomainOrderInclude;
type OrderRow = Prisma.DomainOrderGetPayload<{ include: typeof ORDER_INCLUDE }>;

/** Bangladeshi numbers go to the registrar as country code 880 + local digits. */
function registrantContact(r: RegistrantDto): RegistrantContact {
  const digits = r.phone.replace(/\D/g, '');
  const local = digits.replace(/^(?:00)?880/, '').replace(/^0/, '');
  return {
    name: r.name,
    email: r.email,
    phone: local,
    phoneCountryCode: '880',
    address: r.address,
    city: r.city,
    postcode: r.postcode,
    country: r.country ?? 'BD',
  };
}

/**
 * Domains bought through Ecomesta (Dynadot reseller). A merchant searches,
 * pays by mobile wallet and the order waits for a Super Admin; approving it
 * registers the domain in the merchant's name, points it at the platform and
 * connects it to their store. Renewals work the same way. Prices always come
 * from a fresh registrar quote, never from the client.
 */
@Injectable()
export class DomainSalesService {
  private readonly logger = new Logger(DomainSalesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly audit: AuditService,
    private readonly authorization: AuthorizationService,
    private readonly resolver: StoreDomainResolver,
    private readonly edgeQueue: DomainEdgeQueueService,
    @Inject(DOMAIN_REGISTRAR) private readonly registrar: DomainRegistrar,
  ) {}

  settings(): Promise<DomainSalesSettings> {
    return loadDomainSalesSettings(this.prisma);
  }

  async updateSettings(adminUserId: string, patch: Partial<DomainSalesSettings>, req?: Request) {
    const next = readDomainSalesSettings({ ...(await this.settings()), ...patch });
    await this.prisma.platformSetting.upsert({
      where: { key: DOMAIN_SALES_SETTINGS_KEY },
      create: { key: DOMAIN_SALES_SETTINGS_KEY, value: next as unknown as Prisma.InputJsonValue },
      update: { value: next as unknown as Prisma.InputJsonValue },
    });
    await this.audit.log({ action: 'DOMAIN_SALES_SETTINGS_UPDATED', entityType: 'PlatformSetting', entityId: DOMAIN_SALES_SETTINGS_KEY, userId: adminUserId, metadata: { ...next }, req });
    return { success: true as const, data: next };
  }

  /** Public search: the asked name on every offered extension, with taka prices. */
  async search(query: string) {
    const settings = await this.settings();
    if (!settings.enabled) throw new ServiceUnavailableException('Domain sales are not available right now.');
    const parsed = parseDomainQuery(query);
    if (!parsed) throw new BadRequestException('Type a name of 2 to 63 letters, numbers or hyphens.');
    const tlds = parsed.tld && settings.tlds.includes(parsed.tld) ? [parsed.tld, ...settings.tlds.filter((t) => t !== parsed.tld)] : settings.tlds;
    const results = [];
    for (const tld of tlds) {
      const domain = `${parsed.label}.${tld}`;
      try {
        results.push(this.offer(await this.check(domain), settings));
      } catch (err) {
        if (!(err instanceof RegistrarError)) throw err;
        results.push({ domain, available: false, premium: false, priceBdt: null, renewBdt: null, error: true });
      }
    }
    return { success: true as const, data: { query: parsed.label, results, maxYears: settings.maxYears } };
  }

  async createOrder(userId: string, storeId: string, dto: CreateDomainOrderDto, req?: Request) {
    const store = await this.requirePayingStore(userId, storeId);
    const settings = await this.settings();
    if (!settings.enabled) throw new ServiceUnavailableException('Domain sales are not available right now.');
    const domain = dto.domain.trim().toLowerCase();
    if (!isSellableDomain(domain, settings)) throw new BadRequestException('This domain extension is not offered.');
    if (dto.years > settings.maxYears) throw new BadRequestException(`You can register for up to ${settings.maxYears} years.`);
    if (await this.prisma.registeredDomain.findUnique({ where: { name: domain }, select: { id: true } })) {
      throw new ConflictException('This domain is already registered through Ecomesta.');
    }
    const open = await this.prisma.domainOrder.findFirst({
      where: { domainName: domain, kind: DomainOrderKind.REGISTER, status: { in: [DomainOrderStatus.PENDING, DomainOrderStatus.PROCESSING] } },
      select: { id: true },
    });
    if (open) throw new ConflictException('Someone has already ordered this domain. Please choose another one.');

    // Always a fresh registrar answer: availability and price at the moment of ordering.
    const availability = await this.check(domain, { fresh: true });
    if (!availability.available || availability.premium || availability.registerUsd === null) {
      throw new ConflictException(`${domain} is not available to register.`);
    }
    const perYear = yearlyPriceBdt(availability.registerUsd, settings);
    const prepared = prepareWalletPayment(dto);
    await this.assertTransactionUnused(prepared.method, prepared.transactionId);

    const order = await this.createOrderRow({
      tenantId: store.tenantId,
      storeId: store.id,
      kind: DomainOrderKind.REGISTER,
      domainName: domain,
      years: dto.years,
      amount: perYear * dto.years,
      costUsd: availability.registerUsd * dto.years,
      settings,
      prepared,
      registrant: dto.registrant as unknown as Prisma.InputJsonValue,
      userId,
    });
    await this.audit.log({
      action: 'DOMAIN_ORDER_SUBMITTED',
      entityType: 'DomainOrder',
      entityId: order.id,
      userId,
      tenantId: store.tenantId,
      storeId,
      metadata: { domain, years: dto.years, amount: order.amount.toFixed(2), method: order.method },
      req,
    });
    return { success: true as const, data: this.toMerchantDto(order) };
  }

  async createRenewal(userId: string, storeId: string, registeredDomainId: string, dto: RenewDomainDto, req?: Request) {
    const store = await this.requirePayingStore(userId, storeId);
    const settings = await this.settings();
    const owned = await this.prisma.registeredDomain.findFirst({ where: { id: registeredDomainId, tenantId: store.tenantId } });
    if (!owned) throw new NotFoundException('Domain not found');
    if (dto.years > settings.maxYears) throw new BadRequestException(`You can renew for up to ${settings.maxYears} years.`);
    const open = await this.prisma.domainOrder.findFirst({
      where: { registeredDomainId: owned.id, status: { in: [DomainOrderStatus.PENDING, DomainOrderStatus.PROCESSING] } },
      select: { id: true },
    });
    if (open) throw new ConflictException('A renewal for this domain is already waiting for review.');
    const renewUsd = owned.renewUsd ? Number(owned.renewUsd) : (await this.check(owned.name, { fresh: true })).renewUsd;
    if (renewUsd === null) throw new ServiceUnavailableException('We could not get the renewal price. Please try again later.');
    const prepared = prepareWalletPayment(dto);
    await this.assertTransactionUnused(prepared.method, prepared.transactionId);

    const order = await this.createOrderRow({
      tenantId: store.tenantId,
      storeId: owned.storeId ?? store.id,
      registeredDomainId: owned.id,
      kind: DomainOrderKind.RENEW,
      domainName: owned.name,
      years: dto.years,
      amount: yearlyPriceBdt(renewUsd, settings) * dto.years,
      costUsd: renewUsd * dto.years,
      settings,
      prepared,
      registrant: Prisma.JsonNull,
      userId,
    });
    await this.audit.log({
      action: 'DOMAIN_RENEWAL_SUBMITTED',
      entityType: 'DomainOrder',
      entityId: order.id,
      userId,
      tenantId: store.tenantId,
      storeId,
      metadata: { domain: owned.name, years: dto.years, amount: order.amount.toFixed(2) },
      req,
    });
    return { success: true as const, data: this.toMerchantDto(order) };
  }

  /** The business's domains and orders, for the merchant's Domains page. */
  async listForStore(userId: string, storeId: string) {
    const store = await this.prisma.store.findUnique({ where: { id: storeId }, select: { id: true, tenantId: true } });
    if (!store) throw new NotFoundException('Store not found');
    await this.authorization.assertStoreAccess(userId, storeId);
    const settings = await this.settings();
    const [domains, orders] = await Promise.all([
      this.prisma.registeredDomain.findMany({ where: { tenantId: store.tenantId }, orderBy: { expiresAt: 'asc' } }),
      this.prisma.domainOrder.findMany({ where: { tenantId: store.tenantId }, include: ORDER_INCLUDE, orderBy: { createdAt: 'desc' }, take: 50 }),
    ]);
    return {
      success: true as const,
      data: {
        enabled: settings.enabled,
        maxYears: settings.maxYears,
        domains: domains.map((d) => ({
          id: d.id,
          name: d.name,
          storeId: d.storeId,
          registeredAt: d.registeredAt.toISOString(),
          expiresAt: d.expiresAt.toISOString(),
          renewBdt: d.renewUsd ? yearlyPriceBdt(Number(d.renewUsd), settings) : null,
        })),
        orders: orders.map((o) => this.toMerchantDto(o)),
      },
    };
  }

  async adminList(query: { status?: DomainOrderStatus; page?: number; limit?: number }) {
    const limit = Math.min(Math.max(query.limit ?? 20, 1), 100);
    const page = Math.max(query.page ?? 1, 1);
    const where: Prisma.DomainOrderWhereInput = query.status ? { status: query.status } : {};
    const [rows, total, pendingCount] = await this.prisma.$transaction([
      this.prisma.domainOrder.findMany({ where, include: ORDER_INCLUDE, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
      this.prisma.domainOrder.count({ where }),
      this.prisma.domainOrder.count({ where: { status: DomainOrderStatus.PENDING } }),
    ]);
    return {
      success: true as const,
      data: {
        items: rows.map((row) => this.toAdminDto(row)),
        meta: { total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) },
        pendingCount,
        registrarMode: this.registrar.mode,
      },
    };
  }

  async registrarBalance() {
    try {
      return { success: true as const, data: { mode: this.registrar.mode, balanceUsd: await this.registrar.balanceUsd() } };
    } catch (err) {
      if (err instanceof RegistrarError) return { success: true as const, data: { mode: this.registrar.mode, balanceUsd: null, error: err.message } };
      throw err;
    }
  }

  /**
   * Registers or renews the domain at the registrar. The order is claimed
   * (PENDING/FAILED → PROCESSING) first so it can never be processed twice; a
   * registrar refusal leaves it FAILED with the reason, ready for a retry.
   */
  async approve(adminUserId: string, orderId: string, req?: Request) {
    const claimed = await this.prisma.domainOrder.updateMany({
      where: { id: orderId, status: { in: [DomainOrderStatus.PENDING, DomainOrderStatus.FAILED] } },
      data: { status: DomainOrderStatus.PROCESSING, reviewedByUserId: adminUserId, reviewedAt: new Date(), failureReason: null },
    });
    const order = await this.prisma.domainOrder.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Domain order not found');
    if (claimed.count === 0) {
      if (order.status === DomainOrderStatus.COMPLETED) return this.adminResult(orderId);
      throw new ConflictException(
        order.status === DomainOrderStatus.REJECTED ? 'This payment was rejected and cannot be approved' : 'This order is already being processed',
      );
    }

    try {
      if (order.kind === DomainOrderKind.REGISTER) await this.fulfilRegistration(order);
      else await this.fulfilRenewal(order);
    } catch (err) {
      const reason = err instanceof RegistrarError ? err.message : 'Unexpected error while contacting the registrar.';
      if (!(err instanceof RegistrarError)) this.logger.error(`Domain order ${orderId} failed: ${(err as Error).message}`);
      await this.prisma.domainOrder.update({ where: { id: orderId }, data: { status: DomainOrderStatus.FAILED, failureReason: reason.slice(0, 500) } });
      await this.audit.log({ action: 'DOMAIN_ORDER_FAILED', entityType: 'DomainOrder', entityId: orderId, userId: adminUserId, tenantId: order.tenantId, metadata: { domain: order.domainName, reason }, req });
      return this.adminResult(orderId);
    }

    await this.audit.log({
      action: order.kind === DomainOrderKind.REGISTER ? 'DOMAIN_REGISTERED' : 'DOMAIN_RENEWED',
      entityType: 'DomainOrder',
      entityId: orderId,
      userId: adminUserId,
      tenantId: order.tenantId,
      metadata: { domain: order.domainName, years: order.years, registrar: this.registrar.mode },
      req,
    });
    return this.adminResult(orderId);
  }

  async reject(adminUserId: string, orderId: string, reason: string, req?: Request) {
    const updated = await this.prisma.domainOrder.updateMany({
      where: { id: orderId, status: { in: [DomainOrderStatus.PENDING, DomainOrderStatus.FAILED] } },
      data: { status: DomainOrderStatus.REJECTED, rejectionReason: reason.trim(), reviewedByUserId: adminUserId, reviewedAt: new Date() },
    });
    if (updated.count === 0) {
      const exists = await this.prisma.domainOrder.findUnique({ where: { id: orderId }, select: { id: true } });
      if (!exists) throw new NotFoundException('Domain order not found');
      throw new ConflictException('Only an order waiting for review (or one that failed) can be rejected');
    }
    const row = await this.prisma.domainOrder.findUniqueOrThrow({ where: { id: orderId } });
    await this.audit.log({ action: 'DOMAIN_ORDER_REJECTED', entityType: 'DomainOrder', entityId: orderId, userId: adminUserId, tenantId: row.tenantId, metadata: { domain: row.domainName, reason: row.rejectionReason }, req });
    return this.adminResult(orderId);
  }

  private async fulfilRegistration(order: { id: string; tenantId: string; storeId: string | null; domainName: string; years: number; registrant: Prisma.JsonValue }) {
    const registrant = order.registrant as unknown as RegistrantDto | null;
    if (!registrant) throw new RegistrarError('The order has no registrant details.');
    const now = await this.check(order.domainName, { fresh: true });
    if (!now.available) throw new RegistrarError(`${order.domainName} is no longer available. Refund the merchant or offer another domain.`);
    const contactId = await this.registrar.createContact(registrantContact(registrant));
    const { expiresAt } = await this.registrar.register(order.domainName, order.years, contactId);

    const registered = await this.prisma.registeredDomain.create({
      data: {
        tenantId: order.tenantId,
        storeId: order.storeId,
        name: order.domainName,
        registrar: 'dynadot',
        registeredAt: new Date(),
        expiresAt,
        renewUsd: now.renewUsd ?? now.registerUsd,
      },
    });
    await this.prisma.domainOrder.update({
      where: { id: order.id },
      data: { status: DomainOrderStatus.COMPLETED, completedAt: new Date(), registeredDomainId: registered.id },
    });

    // DNS and the store connection are best effort: the domain is bought either way.
    try {
      await this.registrar.pointToPlatform(order.domainName, { aRecord: this.resolver.aRecordTarget, cname: this.resolver.cnameTarget });
    } catch (err) {
      this.logger.warn(`DNS for ${order.domainName} not set: ${(err as Error).message}`);
    }
    if (order.storeId) await this.connectToStore(order.storeId, order.domainName);
  }

  private async fulfilRenewal(order: { id: string; registeredDomainId: string | null; domainName: string; years: number }) {
    if (!order.registeredDomainId) throw new RegistrarError('The renewal is not linked to a registered domain.');
    const { expiresAt } = await this.registrar.renew(order.domainName, order.years);
    await this.prisma.$transaction([
      this.prisma.registeredDomain.update({ where: { id: order.registeredDomainId }, data: { expiresAt, lastReminderDays: null } }),
      this.prisma.domainOrder.update({ where: { id: order.id }, data: { status: DomainOrderStatus.COMPLETED, completedAt: new Date() } }),
    ]);
  }

  /** We control the domain's DNS, so it is connected without the TXT check. */
  private async connectToStore(storeId: string, hostname: string) {
    const existing = await this.prisma.domain.findUnique({ where: { hostname }, select: { id: true } });
    if (existing) return;
    await this.prisma.domain.create({
      data: { storeId, hostname, type: DomainType.CUSTOM_DOMAIN, status: DomainStatus.ACTIVE, isPrimary: false, verifiedAt: new Date() },
    });
    await this.resolver.invalidateStore(storeId);
    await this.edgeQueue.enqueue('provision', hostname);
  }

  /** Registrar answer for one name, cached for searches (fresh for orders). */
  private async check(domain: string, opts: { fresh?: boolean } = {}): Promise<DomainAvailability> {
    const key = `domain-sales:search:${domain}`;
    if (!opts.fresh) {
      try {
        const cached = await this.redis.getClient().get(key);
        if (cached) return JSON.parse(cached) as DomainAvailability;
      } catch {
        /* cache is optional */
      }
    }
    const result = await this.registrar.search(domain);
    try {
      await this.redis.getClient().set(key, JSON.stringify(result), 'EX', SEARCH_CACHE_SECONDS);
    } catch {
      /* cache is optional */
    }
    return result;
  }

  private offer(a: DomainAvailability, settings: DomainSalesSettings) {
    const sellable = a.available && !a.premium && a.registerUsd !== null;
    return {
      domain: a.domain,
      available: sellable,
      premium: a.premium,
      priceBdt: sellable ? yearlyPriceBdt(a.registerUsd!, settings) : null,
      renewBdt: sellable && a.renewUsd !== null ? yearlyPriceBdt(a.renewUsd, settings) : null,
    };
  }

  private async requirePayingStore(userId: string, storeId: string) {
    const store = await this.prisma.store.findUnique({ where: { id: storeId }, select: { id: true, tenantId: true, deletedAt: true } });
    if (!store || store.deletedAt) throw new NotFoundException('Store not found');
    // Paying is for the business owner or an admin, as for plan and theme payments.
    await this.authorization.assertTenantRole(userId, store.tenantId, [TenantRole.OWNER, TenantRole.ADMIN]);
    return store;
  }

  /** A wallet transaction pays for one thing only: a plan, a theme or a domain. */
  private async assertTransactionUnused(method: Prisma.DomainOrderCreateInput['method'], transactionId: string) {
    const [plan, theme] = await Promise.all([
      this.prisma.billingPayment.findFirst({ where: { method, transactionId }, select: { id: true } }),
      this.prisma.themePurchase.findFirst({ where: { method, transactionId }, select: { id: true } }),
    ]);
    if (plan || theme) throw this.transactionUsed();
  }

  private async createOrderRow(input: {
    tenantId: string;
    storeId: string | null;
    registeredDomainId?: string;
    kind: DomainOrderKind;
    domainName: string;
    years: number;
    amount: number;
    costUsd: number;
    settings: DomainSalesSettings;
    prepared: ReturnType<typeof prepareWalletPayment>;
    registrant: Prisma.InputJsonValue | typeof Prisma.JsonNull;
    userId: string;
  }): Promise<OrderRow> {
    try {
      return await this.prisma.domainOrder.create({
        data: {
          tenantId: input.tenantId,
          storeId: input.storeId,
          registeredDomainId: input.registeredDomainId ?? null,
          kind: input.kind,
          domainName: input.domainName,
          years: input.years,
          amount: input.amount,
          costUsd: Math.round(input.costUsd * 100) / 100,
          usdRate: input.settings.usdRate,
          marginBdt: input.settings.marginBdt,
          method: input.prepared.method,
          payToNumber: input.prepared.account.number,
          senderNumber: input.prepared.senderNumber,
          transactionId: input.prepared.transactionId,
          registrant: input.registrant,
          submittedByUserId: input.userId,
        },
        include: ORDER_INCLUDE,
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') throw this.transactionUsed();
      throw err;
    }
  }

  private transactionUsed() {
    return new ConflictException('This transaction ID has already been submitted. Check the ID in your payment message.');
  }

  private async adminResult(orderId: string) {
    const row = await this.prisma.domainOrder.findUniqueOrThrow({ where: { id: orderId }, include: ORDER_INCLUDE });
    return { success: true as const, data: this.toAdminDto(row) };
  }

  private toMerchantDto(row: OrderRow) {
    return {
      id: row.id,
      kind: row.kind,
      domain: row.domainName,
      years: row.years,
      amount: row.amount.toFixed(2),
      method: row.method,
      senderNumber: row.senderNumber,
      transactionId: row.transactionId,
      status: row.status,
      failureReason: row.status === DomainOrderStatus.FAILED ? 'We are finishing your order. Our team will contact you if anything is needed.' : null,
      rejectionReason: row.rejectionReason,
      store: row.store,
      createdAt: row.createdAt.toISOString(),
      completedAt: row.completedAt?.toISOString() ?? null,
    };
  }

  private toAdminDto(row: OrderRow) {
    return {
      ...this.toMerchantDto(row),
      failureReason: row.failureReason,
      payToNumber: row.payToNumber,
      costUsd: row.costUsd.toFixed(2),
      usdRate: row.usdRate.toFixed(2),
      marginBdt: row.marginBdt.toFixed(2),
      registrant: row.registrant,
      tenant: row.tenant,
      submittedBy: row.submittedBy,
      reviewedBy: row.reviewedBy,
      reviewedAt: row.reviewedAt?.toISOString() ?? null,
    };
  }
}
