import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  OrderStatus,
  PaymentMethod,
  PaymentProvider,
  PaymentStatus,
  Prisma,
  StoreStatus,
  TenantStatus,
} from '@prisma/client';
import type { Request } from 'express';
import { moneyToString } from '../../common/utils/catalog.util';
import { AuditService } from '../audit/audit.service';
import { BillingAccessService } from '../billing/billing-access.service';
import { PrismaService } from '../../prisma/prisma.service';
import { assertPaymentRecordStatusTransition } from './payment-transitions';
import { PlanEntitlementsService } from '../billing/plan-entitlements.service';
import { StoreDomainResolver } from '../domains/store-domain.resolver';
import { PaymentProviderConfigService } from './payment-provider-config.service';
import { generatePaymentInternalReference } from './payment-reference.util';
import { PaymentProviderRegistry } from './providers/payment-provider.registry';

/**
 * Authoritative payment orchestration.
 * Redirect/return URLs never mark payments PAID — only verified webhooks
 * (or trusted server-side provider verification) may do so.
 *
 * Initiate/retry take a row lock on the order (and latest payment) so a
 * concurrent webhook that marks PAID cannot be overwritten back to PENDING.
 */
/** Provider outcomes meaning money was (or may be) taken from the customer. */
const CAPTURE_STATUSES: PaymentStatus[] = [
  PaymentStatus.PAID,
  PaymentStatus.AUTHORIZED,
  PaymentStatus.PARTIALLY_PAID,
];

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

@Injectable()
export class PaymentOrchestrationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
    private readonly providerConfigs: PaymentProviderConfigService,
    private readonly registry: PaymentProviderRegistry,
    private readonly billingAccess: BillingAccessService,
    private readonly entitlements: PlanEntitlementsService,
    private readonly domains: StoreDomainResolver,
  ) {}

  async listPublicProviders(storeSlug: string) {
    const store = await this.requireActiveStoreBySlug(storeSlug);
    const enabled = await this.providerConfigs.listPublicEnabled(store.id);
    // A provider enabled before a plan change stays hidden until the plan includes it.
    const online = [];
    for (const item of enabled) {
      if (await this.entitlements.storeAllowsProvider(store.id, item.provider)) online.push(item);
    }
    return {
      success: true as const,
      data: {
        offline: [
          { provider: PaymentProvider.COD, method: PaymentMethod.CASH },
          {
            provider: PaymentProvider.OTHER,
            method: PaymentMethod.BANK_TRANSFER,
          },
          { provider: PaymentProvider.OTHER, method: PaymentMethod.OTHER },
        ],
        online,
      },
    };
  }

  /**
   * Start an online payment for an existing unpaid order.
   * Amount is always taken from Order.grandTotal — never from the client.
   */
  async initiatePublicPayment(
    storeSlug: string,
    input: {
      publicReference: string;
      provider: PaymentProvider;
      email?: string;
      phone?: string;
      idempotencyKey?: string | null;
    },
    req?: Request,
  ) {
    const store = await this.requireActiveStoreBySlug(storeSlug);
    const order = await this.loadPayableOrder(
      store.id,
      input.publicReference,
      input.email,
      input.phone,
    );

    if (!this.registry.isOnline(input.provider)) {
      throw new BadRequestException('Provider does not support online payment');
    }
    if (!(await this.entitlements.storeAllowsProvider(store.id, input.provider))) {
      throw new BadRequestException('This payment method is not available for this store');
    }

    const claimed = await this.claimPaymentAttemptUnderLock({
      store,
      order,
      provider: input.provider,
      method: PaymentMethod.CARD,
      idempotencyKey: input.idempotencyKey ?? null,
      allowRetryOnly: false,
    });

    if (claimed.kind === 'existing') {
      if (claimed.needsSession) {
        return this.startProviderSession({
          store,
          order,
          payment: claimed.payment,
          req,
        });
      }
      return this.buildInitiateResponse(claimed.payment, store.slug);
    }

    return this.startProviderSession({
      store,
      order,
      payment: claimed.payment,
      req,
    });
  }

  /** Retry after FAILED/CANCELLED without creating a new order. */
  async retryPublicPayment(
    storeSlug: string,
    input: {
      publicReference: string;
      provider: PaymentProvider;
      email?: string;
      phone?: string;
    },
    req?: Request,
  ) {
    const store = await this.requireActiveStoreBySlug(storeSlug);
    const order = await this.loadPayableOrder(
      store.id,
      input.publicReference,
      input.email,
      input.phone,
    );

    const claimed = await this.claimPaymentAttemptUnderLock({
      store,
      order,
      provider: input.provider,
      method: PaymentMethod.CARD,
      idempotencyKey: null,
      allowRetryOnly: true,
    });

    if (claimed.kind === 'existing') {
      if (claimed.needsSession) {
        return this.startProviderSession({
          store,
          order,
          payment: claimed.payment,
          req,
        });
      }
      return this.buildInitiateResponse(claimed.payment, store.slug);
    }

    return this.startProviderSession({
      store,
      order,
      payment: claimed.payment,
      req,
    });
  }

  async getPublicPaymentStatus(
    storeSlug: string,
    internalReference: string,
    contact?: { email?: string; phone?: string },
  ) {
    const store = await this.requireActiveStoreBySlug(storeSlug);
    this.requireContactProof(contact?.email, contact?.phone);

    const payment = await this.prisma.payment.findFirst({
      where: { storeId: store.id, internalReference },
      include: {
        order: {
          select: {
            orderNumber: true,
            publicReference: true,
            paymentStatus: true,
            status: true,
            grandTotal: true,
            currency: true,
            addresses: { select: { email: true, phone: true } },
          },
        },
      },
    });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    if (
      !this.contactMatches(payment.order.addresses, contact?.email, contact?.phone)
    ) {
      throw new NotFoundException('Payment not found');
    }

    return {
      success: true as const,
      data: {
        internalReference: payment.internalReference,
        status: payment.status,
        provider: payment.provider,
        amount: moneyToString(payment.amount)!,
        currency: payment.currency,
        attemptNumber: payment.attemptNumber,
        orderNumber: payment.order.orderNumber,
        publicReference: payment.order.publicReference,
        orderPaymentStatus: payment.order.paymentStatus,
        orderStatus: payment.order.status,
        providerPaymentId: payment.providerPaymentId,
        updatedAt: payment.updatedAt,
      },
    };
  }

  /**
   * Process a verified provider webhook.
   * Idempotent on (provider, eventId).
   */
  async handleWebhook(
    provider: PaymentProvider,
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
  ) {
    if (!this.registry.isOnline(provider)) {
      throw new BadRequestException('Unknown payment webhook provider');
    }

    // Resolve payment from unsigned peek (provider-specific shapes), then verify
    // with store secrets. Never treat peek as authoritative for status.
    const peek = this.safePeekJson(rawBody);
    const peekedRef = this.peekInternalReference(peek);
    const peekedProviderPaymentId = this.peekProviderPaymentId(peek);

    let payment = peekedRef
      ? await this.prisma.payment.findFirst({
          where: { internalReference: peekedRef, provider },
        })
      : null;

    if (!payment && peekedProviderPaymentId) {
      payment = await this.prisma.payment.findFirst({
        where: {
          provider,
          providerPaymentId: peekedProviderPaymentId,
        },
      });
    }

    if (!payment) {
      throw new NotFoundException('Payment not found for webhook');
    }

    const { publicConfig, secrets, mode } =
      await this.providerConfigs.requireEnabledConfig(
        payment.storeId,
        provider,
      );

    const adapter = this.registry.getAdapter(provider);
    const event = await adapter.verifyWebhook({
      rawBody,
      headers,
      publicConfig,
      secrets,
      mode,
    });

    // Idempotency: claim event id
    const existingEvent = await this.prisma.paymentWebhookEvent.findUnique({
      where: {
        provider_eventId: { provider, eventId: event.eventId },
      },
    });
    if (existingEvent?.processedAt) {
      return {
        success: true as const,
        data: { replayed: true, eventId: event.eventId },
      };
    }

    if (!existingEvent) {
      try {
        await this.prisma.paymentWebhookEvent.create({
          data: {
            provider,
            eventId: event.eventId,
            eventType: event.eventType,
            storeId: payment.storeId,
            paymentId: payment.id,
            summary: (event.summary ?? {}) as Prisma.InputJsonValue,
          },
        });
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2002'
        ) {
          // Another worker claimed the same eventId. Reload and either
          // treat as replay or continue apply (never silently drop apply).
          const raced = await this.prisma.paymentWebhookEvent.findUnique({
            where: {
              provider_eventId: { provider, eventId: event.eventId },
            },
          });
          if (raced?.processedAt) {
            return {
              success: true as const,
              data: { replayed: true, eventId: event.eventId },
            };
          }
          // processedAt still null — fall through to applyVerifiedStatus.
        } else {
          throw err;
        }
      }
    }

    const applied = await this.applyVerifiedStatus({
      paymentId: payment.id,
      storeId: payment.storeId,
      orderId: payment.orderId,
      toStatus: event.status,
      providerPaymentId: event.providerPaymentId,
      expectedAmount: payment.amount,
      webhookAmount: event.amount ?? null,
      eventId: event.eventId,
      eventType: event.eventType,
      provider,
    });

    return {
      success: true as const,
      data: {
        replayed: false,
        eventId: event.eventId,
        status: applied.status,
        ...(applied.lateCapture ? { lateCapture: true } : {}),
      },
    };
  }

  /**
   * Under FOR UPDATE on the order (+ latest payment): re-check PAID, honor
   * idempotencyKey, allocate attemptNumber = max+1, and never set order to
   * PENDING when it is already PAID.
   */
  private async claimPaymentAttemptUnderLock(params: {
    store: { id: string; slug: string; tenantId: string; currency: string };
    order: {
      id: string;
      orderNumber: string;
      publicReference: string | null;
      grandTotal: Prisma.Decimal;
      currency: string;
      addresses?: OrderAddressPeek[];
      paymentStatus: PaymentStatus;
    };
    provider: PaymentProvider;
    method: PaymentMethod;
    idempotencyKey: string | null;
    allowRetryOnly: boolean;
  }): Promise<
    | {
        kind: 'existing';
        payment: LockedPaymentRow;
        needsSession: boolean;
      }
    | { kind: 'created'; payment: LockedPaymentRow }
  > {
    return this.prisma.$transaction(async (tx) => {
      const lockedOrders = await tx.$queryRaw<
        {
          id: string;
          payment_status: PaymentStatus;
          status: OrderStatus;
        }[]
      >`
        SELECT id, payment_status, status
        FROM orders
        WHERE id = ${params.order.id}::uuid AND store_id = ${params.store.id}::uuid
        FOR UPDATE
      `;
      const lockedOrder = lockedOrders[0];
      if (!lockedOrder) {
        throw new NotFoundException('Order not found');
      }
      if (lockedOrder.status === OrderStatus.CANCELLED) {
        throw new UnprocessableEntityException('Cannot pay a cancelled order');
      }
      if (lockedOrder.payment_status === PaymentStatus.PAID) {
        throw new UnprocessableEntityException('Order is already paid');
      }

      const lockedPayments = await tx.$queryRaw<
        {
          id: string;
          status: PaymentStatus;
          provider: PaymentProvider;
          attempt_number: number;
          internal_reference: string;
          provider_payment_id: string | null;
          amount: Prisma.Decimal;
          currency: string;
          method: PaymentMethod;
          metadata: Prisma.JsonValue | null;
        }[]
      >`
        SELECT id, status, provider, attempt_number, internal_reference,
               provider_payment_id, amount, currency, method, metadata
        FROM payments
        WHERE order_id = ${params.order.id}::uuid AND store_id = ${params.store.id}::uuid
        ORDER BY attempt_number DESC, created_at DESC
        LIMIT 1
        FOR UPDATE
      `;
      const latest = lockedPayments[0] ?? null;

      if (latest?.status === PaymentStatus.PAID) {
        throw new UnprocessableEntityException('Order is already paid');
      }

      if (params.idempotencyKey) {
        const prior = await tx.payment.findFirst({
          where: {
            orderId: params.order.id,
            storeId: params.store.id,
            metadata: {
              path: ['idempotencyKey'],
              equals: params.idempotencyKey,
            },
          },
        });
        if (prior) {
          return {
            kind: 'existing' as const,
            payment: this.toLockedPayment(prior),
            needsSession: !this.hasRedirectUrl(prior.metadata),
          };
        }
      }

      if (
        !params.allowRetryOnly &&
        latest &&
        (latest.status === PaymentStatus.PENDING ||
          latest.status === PaymentStatus.AUTHORIZED) &&
        latest.provider === params.provider
      ) {
        return {
          kind: 'existing' as const,
          payment: {
            id: latest.id,
            internalReference: latest.internal_reference,
            attemptNumber: latest.attempt_number,
            provider: latest.provider,
            method: latest.method,
            amount: latest.amount,
            currency: latest.currency,
            status: latest.status,
            providerPaymentId: latest.provider_payment_id,
            metadata: latest.metadata,
          },
          needsSession: !this.hasRedirectUrl(latest.metadata),
        };
      }

      if (params.allowRetryOnly) {
        if (!latest) {
          throw new NotFoundException('No payment attempt found for this order');
        }
        if (
          latest.status !== PaymentStatus.FAILED &&
          latest.status !== PaymentStatus.CANCELLED
        ) {
          throw new UnprocessableEntityException(
            'Only failed or cancelled payments can be retried',
          );
        }
      }

      const maxRows = await tx.$queryRaw<{ max: number | null }[]>`
        SELECT MAX(attempt_number) AS max
        FROM payments
        WHERE order_id = ${params.order.id}::uuid
      `;
      const attemptNumber = (maxRows[0]?.max ?? 0) + 1;
      const internalReference = generatePaymentInternalReference();

      const metadata: Prisma.InputJsonValue | undefined = params.idempotencyKey
        ? { idempotencyKey: params.idempotencyKey }
        : undefined;

      const payment = await tx.payment.create({
        data: {
          storeId: params.store.id,
          orderId: params.order.id,
          internalReference,
          attemptNumber,
          provider: params.provider,
          method: params.method,
          amount: params.order.grandTotal,
          currency: params.order.currency,
          status: PaymentStatus.PENDING,
          ...(metadata ? { metadata } : {}),
        },
      });

      // Re-read payment_status under the same lock before writing PENDING.
      // Never overwrite PAID → PENDING (webhook may have landed mid-flight).
      const recheck = await tx.$queryRaw<{ payment_status: PaymentStatus }[]>`
        SELECT payment_status
        FROM orders
        WHERE id = ${params.order.id}::uuid
        FOR UPDATE
      `;
      if (recheck[0]?.payment_status === PaymentStatus.PAID) {
        throw new UnprocessableEntityException('Order is already paid');
      }

      await tx.order.update({
        where: { id: params.order.id },
        data: { paymentStatus: PaymentStatus.PENDING },
      });

      return {
        kind: 'created' as const,
        payment: this.toLockedPayment(payment),
      };
    });
  }

  private toLockedPayment(payment: {
    id: string;
    internalReference: string;
    attemptNumber: number;
    provider: PaymentProvider;
    method: PaymentMethod;
    amount: Prisma.Decimal;
    currency: string;
    status: PaymentStatus;
    providerPaymentId: string | null;
    metadata: Prisma.JsonValue | null;
  }): LockedPaymentRow {
    return {
      id: payment.id,
      internalReference: payment.internalReference,
      attemptNumber: payment.attemptNumber,
      provider: payment.provider,
      method: payment.method,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      providerPaymentId: payment.providerPaymentId,
      metadata: payment.metadata,
    };
  }

  private hasRedirectUrl(metadata: Prisma.JsonValue | null): boolean {
    const meta = (metadata ?? {}) as { redirectUrl?: string | null };
    return Boolean(meta.redirectUrl);
  }

  private async startProviderSession(params: {
    store: { id: string; slug: string; tenantId: string; currency: string };
    order: {
      id: string;
      orderNumber: string;
      publicReference: string | null;
      grandTotal: Prisma.Decimal;
      currency: string;
      addresses?: OrderAddressPeek[];
    };
    payment: LockedPaymentRow;
    req?: Request;
  }) {
    const { publicConfig, secrets, mode } =
      await this.providerConfigs.requireEnabledConfig(
        params.store.id,
        params.payment.provider,
      );

    // Providers send the shopper back to the storefront the payment started on
    // (its verified custom domain or platform subdomain), where the result
    // pages and the tab's contact proof live — not the platform website.
    const storefrontOrigin = await this.domains.storefrontOrigin(params.store);
    const apiBaseUrl = this.config.get<string>('API_URL')!.replace(/\/$/, '');
    const ref = params.order.publicReference!;
    const customer = this.customerFromAddresses(params.order.addresses);
    // No contact details in return URLs: they pass through the provider, browser
    // history, analytics and referrers. The result page keeps its own contact proof.
    // `ref` is this attempt's opaque internal reference: the result page needs it
    // (with the contact proof) to read the payment status.
    const returnQs = `store=${encodeURIComponent(params.store.slug)}&order=${encodeURIComponent(ref)}&ref=${encodeURIComponent(params.payment.internalReference)}`;
    const returnUrls = {
      success: `${storefrontOrigin}/payment/success?${returnQs}`,
      cancel: `${storefrontOrigin}/payment/cancel?${returnQs}`,
      failure: `${storefrontOrigin}/payment/failure?${returnQs}`,
    };

    const adapter = this.registry.getAdapter(params.payment.provider);
    const created = await adapter.createPayment({
      storeId: params.store.id,
      orderId: params.order.id,
      paymentId: params.payment.id,
      internalReference: params.payment.internalReference,
      amount: params.order.grandTotal,
      currency: params.order.currency,
      method: params.payment.method,
      returnUrls,
      customer,
      publicConfig: {
        ...publicConfig,
        simulateBaseUrl: storefrontOrigin,
        apiBaseUrl,
      },
      secrets,
      mode,
    });

    const priorMeta = (params.payment.metadata ?? {}) as Record<string, unknown>;
    const updated = await this.prisma.payment.update({
      where: { id: params.payment.id },
      data: {
        providerPaymentId: created.providerPaymentId,
        metadata: {
          ...priorMeta,
          redirectUrl: created.redirectUrl,
          clientPayload: created.clientPayload ?? null,
        } as Prisma.InputJsonValue,
      },
    });

    await this.audit.log({
      action: 'PAYMENT_INITIATED',
      entityType: 'Payment',
      entityId: params.payment.id,
      tenantId: params.store.tenantId,
      storeId: params.store.id,
      metadata: {
        orderId: params.order.id,
        orderNumber: params.order.orderNumber,
        provider: params.payment.provider,
        attemptNumber: params.payment.attemptNumber,
        amount: moneyToString(params.order.grandTotal),
        internalReference: params.payment.internalReference,
      },
      req: params.req,
    });

    return this.buildInitiateResponse(updated, params.store.slug);
  }

  private buildInitiateResponse(
    payment: {
      id: string;
      internalReference: string;
      status: PaymentStatus;
      provider: PaymentProvider;
      amount: Prisma.Decimal;
      currency: string;
      attemptNumber: number;
      providerPaymentId: string | null;
      metadata: Prisma.JsonValue | null;
    },
    storeSlug: string,
  ) {
    const meta = (payment.metadata ?? {}) as {
      redirectUrl?: string | null;
      clientPayload?: Record<string, unknown> | null;
    };
    return {
      success: true as const,
      data: {
        paymentId: payment.id,
        internalReference: payment.internalReference,
        status: payment.status,
        provider: payment.provider,
        amount: moneyToString(payment.amount)!,
        currency: payment.currency,
        attemptNumber: payment.attemptNumber,
        providerPaymentId: payment.providerPaymentId,
        redirectUrl: meta.redirectUrl ?? null,
        clientPayload: meta.clientPayload ?? null,
        storeSlug,
      },
    };
  }

  /**
   * Apply a verified provider status. Transitions TO PAID require a non-null
   * webhookAmount that equals the expected payment amount.
   */
  async applyVerifiedStatus(params: {
    paymentId: string;
    storeId: string;
    orderId: string;
    toStatus: PaymentStatus;
    providerPaymentId: string | null;
    expectedAmount: Prisma.Decimal;
    webhookAmount: Prisma.Decimal | null;
    eventId: string;
    eventType: string;
    provider: PaymentProvider;
  }) {
    if (params.toStatus === PaymentStatus.PAID) {
      if (params.webhookAmount == null) {
        throw new UnprocessableEntityException(
          'Webhook amount is required when marking a payment PAID',
        );
      }
      if (!params.webhookAmount.equals(params.expectedAmount)) {
        throw new UnprocessableEntityException(
          'Webhook amount does not match order payment amount',
        );
      }
    } else if (
      params.webhookAmount &&
      !params.webhookAmount.equals(params.expectedAmount)
    ) {
      throw new UnprocessableEntityException(
        'Webhook amount does not match order payment amount',
      );
    }

    const markProcessed = (tx: Prisma.TransactionClient, paymentId: string) =>
      tx.paymentWebhookEvent.update({
        where: {
          provider_eventId: {
            provider: params.provider,
            eventId: params.eventId,
          },
        },
        data: {
          processedAt: new Date(),
          paymentId,
          storeId: params.storeId,
        },
      });

    // Lock order, then payment: the same order as order cancellation and
    // payment attempts, so a cancel and a verified success are serialised and
    // the one that commits second sees the other's result.
    const outcome = await this.prisma.$transaction(async (tx) => {
      const lockedOrders = await tx.$queryRaw<
        { id: string; status: OrderStatus; order_number: string; currency: string }[]
      >`
        SELECT id, status, order_number, currency
        FROM orders
        WHERE id = ${params.orderId}::uuid AND store_id = ${params.storeId}::uuid
        FOR UPDATE
      `;
      const order = lockedOrders[0];
      if (!order) {
        throw new NotFoundException('Order not found for payment');
      }

      const locked = await tx.$queryRaw<
        {
          id: string;
          status: PaymentStatus;
          order_id: string;
          metadata: Prisma.JsonValue | null;
          amount: Prisma.Decimal;
          currency: string;
        }[]
      >`
        SELECT id, status, order_id, metadata, amount, currency
        FROM payments
        WHERE id = ${params.paymentId}::uuid AND store_id = ${params.storeId}::uuid
        FOR UPDATE
      `;
      const row = locked[0];
      if (!row || row.order_id !== order.id) {
        throw new NotFoundException('Payment not found');
      }

      if (order.status === OrderStatus.CANCELLED) {
        // SF-01: a cancelled order never becomes paid. A verified capture that
        // arrives after cancellation is kept as evidence on the payment for a
        // manual refund; the order and payment are not marked PAID.
        if (CAPTURE_STATUSES.includes(params.toStatus)) {
          const metadata = isJsonObject(row.metadata) ? row.metadata : {};
          const already = isJsonObject(metadata.lateCapture);
          if (!already) {
            await tx.payment.update({
              where: { id: row.id },
              data: {
                ...(params.providerPaymentId
                  ? { providerPaymentId: params.providerPaymentId }
                  : {}),
                // A cancelled order's attempt is closed as CANCELLED; the
                // capture itself is recorded below, not as a PAID status.
                ...(row.status === PaymentStatus.CANCELLED
                  ? {}
                  : { status: PaymentStatus.CANCELLED }),
                metadata: {
                  ...metadata,
                  lateCapture: {
                    reportedStatus: params.toStatus,
                    eventId: params.eventId,
                    eventType: params.eventType,
                    providerPaymentId: params.providerPaymentId,
                    amount: (params.webhookAmount ?? row.amount).toFixed(2),
                    currency: row.currency,
                    receivedAt: new Date().toISOString(),
                    orderStatus: OrderStatus.CANCELLED,
                    requiresManualRefund: true,
                  },
                } as Prisma.InputJsonValue,
              },
            });
          }
          await markProcessed(tx, row.id);
          return {
            kind: 'late_capture' as const,
            firstReport: !already,
            orderNumber: order.order_number,
            currency: row.currency,
            amount: (params.webhookAmount ?? row.amount).toFixed(2),
            paymentStatus: PaymentStatus.CANCELLED,
          };
        }
        // Other provider outcomes change nothing on a cancelled order.
        await markProcessed(tx, row.id);
        return { kind: 'ignored' as const, paymentStatus: row.status };
      }

      if (row.status === params.toStatus) {
        await markProcessed(tx, row.id);
        return { kind: 'unchanged' as const, paymentStatus: row.status };
      }

      // Allow FAILED→PAID? No — must go FAILED→PENDING via retry (new attempt).
      // Same attempt: only valid transitions.
      assertPaymentRecordStatusTransition(row.status, params.toStatus);

      await tx.payment.update({
        where: { id: row.id },
        data: {
          status: params.toStatus,
          ...(params.providerPaymentId
            ? { providerPaymentId: params.providerPaymentId }
            : {}),
        },
      });

      await tx.order.update({
        where: { id: order.id },
        data: { paymentStatus: params.toStatus },
      });

      await markProcessed(tx, row.id);
      return { kind: 'applied' as const, paymentStatus: params.toStatus };
    });

    const store = await this.prisma.store.findUnique({
      where: { id: params.storeId },
      select: { tenantId: true },
    });

    if (outcome.kind === 'late_capture') {
      if (outcome.firstReport) {
        await this.audit.log({
          action: 'PAYMENT_LATE_CAPTURE_REFUND_REQUIRED',
          entityType: 'Payment',
          entityId: params.paymentId,
          tenantId: store?.tenantId,
          storeId: params.storeId,
          metadata: {
            orderId: params.orderId,
            orderNumber: outcome.orderNumber,
            orderStatus: OrderStatus.CANCELLED,
            reportedStatus: params.toStatus,
            amount: outcome.amount,
            currency: outcome.currency,
            provider: params.provider,
            providerPaymentId: params.providerPaymentId,
            eventId: params.eventId,
            eventType: params.eventType,
            requiresManualRefund: true,
          },
        });
      }
      return { status: outcome.paymentStatus, lateCapture: true };
    }
    if (outcome.kind === 'ignored') {
      return { status: outcome.paymentStatus, lateCapture: false };
    }

    const action =
      params.toStatus === PaymentStatus.PAID
        ? 'PAYMENT_PAID'
        : params.toStatus === PaymentStatus.FAILED
          ? 'PAYMENT_FAILED'
          : params.toStatus === PaymentStatus.CANCELLED
            ? 'PAYMENT_CANCELLED'
            : params.toStatus === PaymentStatus.AUTHORIZED
              ? 'PAYMENT_AUTHORIZED'
              : params.toStatus === PaymentStatus.REFUNDED
                ? 'PAYMENT_REFUNDED'
                : 'PAYMENT_STATUS_CHANGED';

    await this.audit.log({
      action,
      entityType: 'Payment',
      entityId: params.paymentId,
      tenantId: store?.tenantId,
      storeId: params.storeId,
      metadata: {
        eventId: params.eventId,
        eventType: params.eventType,
        status: params.toStatus,
        provider: params.provider,
      },
    });
    return { status: outcome.paymentStatus, lateCapture: false };
  }

  private async loadPayableOrder(
    storeId: string,
    publicReference: string,
    email?: string,
    phone?: string,
  ) {
    this.requireContactProof(email, phone);

    const order = await this.prisma.order.findFirst({
      where: { storeId, publicReference },
      include: {
        addresses: {
          select: {
            email: true,
            type: true,
            firstName: true,
            lastName: true,
            phone: true,
            addressLine1: true,
            city: true,
            postalCode: true,
            country: true,
          },
        },
      },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    if (!this.contactMatches(order.addresses, email, phone)) {
      throw new NotFoundException('Order not found');
    }
    if (order.status === OrderStatus.CANCELLED) {
      throw new UnprocessableEntityException('Cannot pay a cancelled order');
    }
    return order;
  }

  /** Require email or phone; wrong/missing → 404 (no enumeration). */
  private requireContactProof(email?: string, phone?: string) {
    if (!email?.trim() && !phone?.trim()) {
      throw new NotFoundException('Order not found');
    }
  }

  private contactMatches(
    addresses: { email?: string | null; phone?: string | null }[],
    email?: string,
    phone?: string,
  ): boolean {
    const mail = email?.trim().toLowerCase();
    const ph = phone?.trim() ? this.normalizePhone(phone) : null;
    if (mail) {
      const ok = addresses.some((a) => a.email?.toLowerCase() === mail);
      if (!ok) return false;
    }
    if (ph) {
      const ok = addresses.some(
        (a) => a.phone && this.normalizePhone(a.phone) === ph,
      );
      if (!ok) return false;
    }
    return true;
  }

  private normalizePhone(value: string): string {
    return value.replace(/[^\d+]/g, '');
  }

  private async requireActiveStoreBySlug(storeSlug: string) {
    const store = await this.prisma.store.findFirst({
      where: {
        slug: storeSlug,
        status: StoreStatus.ACTIVE,
        // Suspended tenants are not publicly operable even if the store row is ACTIVE.
        tenant: { status: TenantStatus.ACTIVE },
      },
      select: { id: true, slug: true, tenantId: true, currency: true },
    });
    if (!store) {
      await this.billingAccess.throwIfSuspended({ slug: storeSlug });
      throw new NotFoundException('Store not found');
    }
    await this.billingAccess.assertTenantInGoodStanding(store.tenantId);
    return store;
  }

  private safePeekJson(rawBody: Buffer): Record<string, unknown> | null {
    const text = rawBody.toString('utf8').trim();
    if (!text) return null;
    try {
      const parsed = JSON.parse(text) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // Fall through to form-urlencoded (SSLCommerz IPN).
    }
    if (text.includes('=')) {
      const params = new URLSearchParams(text);
      const out: Record<string, unknown> = {};
      for (const [key, value] of params.entries()) {
        out[key] = value;
      }
      if (Object.keys(out).length > 0) return out;
    }
    return null;
  }

  /**
   * Unsigned webhook peek helpers for locating Payment before signature verify.
   * Supports TEST flat JSON, Stripe nested Event shapes, and SSLCommerz tran_id.
   */
  private peekInternalReference(
    peek: Record<string, unknown> | null,
  ): string | null {
    if (!peek) return null;
    if (typeof peek.internalReference === 'string' && peek.internalReference) {
      return peek.internalReference;
    }
    if (
      typeof peek.ecomestaInternalReference === 'string' &&
      peek.ecomestaInternalReference
    ) {
      return peek.ecomestaInternalReference;
    }
    if (typeof peek.tran_id === 'string' && peek.tran_id) {
      return peek.tran_id;
    }

    const data = peek.data;
    if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
    const object = (data as Record<string, unknown>).object;
    if (!object || typeof object !== 'object' || Array.isArray(object)) {
      return null;
    }
    const obj = object as Record<string, unknown>;

    if (
      typeof obj.client_reference_id === 'string' &&
      obj.client_reference_id
    ) {
      return obj.client_reference_id;
    }

    const metadata = obj.metadata;
    if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
      const ref = (metadata as Record<string, unknown>)
        .ecomestaInternalReference;
      if (typeof ref === 'string' && ref) return ref;
    }

    return null;
  }

  private peekProviderPaymentId(
    peek: Record<string, unknown> | null,
  ): string | null {
    if (!peek) return null;
    if (typeof peek.providerPaymentId === 'string' && peek.providerPaymentId) {
      return peek.providerPaymentId;
    }
    if (typeof peek.sessionkey === 'string' && peek.sessionkey) {
      return peek.sessionkey;
    }

    const data = peek.data;
    if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
    const object = (data as Record<string, unknown>).object;
    if (!object || typeof object !== 'object' || Array.isArray(object)) {
      return null;
    }
    const id = (object as Record<string, unknown>).id;
    return typeof id === 'string' && id ? id : null;
  }

  private customerFromAddresses(addresses?: OrderAddressPeek[]) {
    if (!addresses?.length) return undefined;
    const preferred =
      addresses.find((a) => a.type === 'SHIPPING') ?? addresses[0]!;
    const nameParts = [preferred.firstName, preferred.lastName]
      .filter((p): p is string => Boolean(p?.trim()))
      .map((p) => p.trim());
    const email =
      addresses.find((a) => a.email)?.email ?? preferred.email ?? null;
    return {
      email,
      name: nameParts.length ? nameParts.join(' ') : null,
      phone: preferred.phone ?? null,
      addressLine1: preferred.addressLine1 ?? null,
      city: preferred.city ?? null,
      postalCode: preferred.postalCode ?? null,
      country: preferred.country ?? null,
    };
  }
}

type LockedPaymentRow = {
  id: string;
  internalReference: string;
  attemptNumber: number;
  provider: PaymentProvider;
  method: PaymentMethod;
  amount: Prisma.Decimal;
  currency: string;
  status: PaymentStatus;
  providerPaymentId: string | null;
  metadata: Prisma.JsonValue | null;
};

type OrderAddressPeek = {
  email: string | null;
  type: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  addressLine1?: string | null;
  city?: string | null;
  postalCode?: string | null;
  country?: string | null;
};
