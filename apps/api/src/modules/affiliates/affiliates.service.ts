import { randomInt } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  AffiliateCommissionStatus,
  AffiliatePayoutStatus,
  AffiliateStatus,
  BillingPaymentStatus,
  Prisma,
  type Affiliate,
  type AffiliateCommission,
  type AffiliatePayout,
} from '@prisma/client';
import type { Request } from 'express';
import type {
  AdminAffiliateCommissionItem,
  AdminAffiliateItem,
  AdminAffiliatePayoutItem,
  AffiliateBalance,
  AffiliateCommissionItem,
  AffiliateMe,
  AffiliatePayoutItem,
  AffiliateProfile,
  AffiliateProgramSettings,
  AffiliateReferralItem,
  AffiliateStats,
} from '@ecomesta/types';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisRateLimitService } from '../../common/rate-limit/redis-rate-limit.service';
import { AuditService } from '../audit/audit.service';
import { EmailConfigService } from '../email/email.config';
import { EMAIL_EVENTS } from '../email/email.events';
import { EmailService } from '../email/email.service';
import { AffiliateSettingsService } from './affiliate-settings.service';
import type {
  AdminAffiliateListQueryDto,
  AdminPayoutListQueryDto,
  AffiliatePayoutMethodDto,
  AffiliateSettingsDto,
  ApplyAffiliateDto,
} from './dto/affiliate.dto';

type Db = Prisma.TransactionClient | PrismaService;

const DAY = 24 * 60 * 60 * 1000;
const CODE_PATTERN = /^[A-Z0-9]{3,32}$/;
const num = (value: Prisma.Decimal | null | undefined) => (value == null ? 0 : Number(value.toString()));
const money = (value: number) => Math.round(value * 100) / 100;

/** "Rahim Traders" → "Ra*** T***": enough for an affiliate to recognise, not to identify. */
export function maskBusinessName(name: string | null | undefined): string | null {
  if (!name?.trim()) return null;
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 3)
    .map((word, index) => {
      const letters = Array.from(word);
      const keep = index === 0 ? Math.min(2, letters.length) : 1;
      return letters.slice(0, keep).join('') + '***';
    })
    .join(' ');
}

@Injectable()
export class AffiliatesService {
  private readonly logger = new Logger(AffiliatesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: AffiliateSettingsService,
    private readonly rateLimit: RedisRateLimitService,
    private readonly audit: AuditService,
    private readonly email: EmailService,
    private readonly emailConfig: EmailConfigService,
  ) {}

  // ---------------------------------------------------------------------------
  // Affiliates (any signed-in account)

  async me(userId: string) {
    const program = await this.settings.get();
    const affiliate = await this.prisma.affiliate.findUnique({ where: { userId } });
    const data: AffiliateMe = { program, affiliate: null, stats: null, balance: null, referralUrl: null };
    if (affiliate) {
      data.affiliate = this.toProfile(affiliate, program);
      data.stats = await this.stats(affiliate);
      data.balance = await this.balance(affiliate.id);
      data.referralUrl = affiliate.status === AffiliateStatus.ACTIVE ? this.referralUrl(affiliate.code) : null;
    }
    return { success: true as const, data };
  }

  /** Applies to the program (again, after a rejection). A Super Admin approves before the link works. */
  async apply(userId: string, dto: ApplyAffiliateDto, req?: Request) {
    const program = await this.settings.get();
    if (!program.enabled) throw new ForbiddenException('The affiliate program is not open right now.');
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { firstName: true, lastName: true, email: true } });
    if (!user) throw new NotFoundException('User not found');
    const existing = await this.prisma.affiliate.findUnique({ where: { userId } });
    let affiliate: Affiliate;
    if (existing) {
      if (existing.status !== AffiliateStatus.REJECTED) {
        throw new ConflictException(existing.status === AffiliateStatus.PENDING ? 'Your application is already waiting for review.' : 'You are already an affiliate.');
      }
      affiliate = await this.prisma.affiliate.update({
        where: { id: existing.id },
        data: { status: AffiliateStatus.PENDING, applicationNote: dto.applicationNote || null, statusReason: null, reviewedAt: null, reviewedByUserId: null },
      });
    } else {
      affiliate = await this.createWithCode(userId, user.firstName ?? user.email, dto.applicationNote || null);
    }
    await this.audit.log({ action: 'AFFILIATE_APPLIED', entityType: 'Affiliate', entityId: affiliate.id, userId, metadata: { code: affiliate.code }, req });
    return this.me(userId);
  }

  async setPayoutMethod(userId: string, dto: AffiliatePayoutMethodDto) {
    const affiliate = await this.requireOwn(userId);
    await this.prisma.affiliate.update({
      where: { id: affiliate.id },
      data: { payoutMethod: dto.method, payoutNumber: dto.number, payoutName: dto.name || null },
    });
    return this.me(userId);
  }

  async referrals(userId: string) {
    const affiliate = await this.requireOwn(userId);
    const rows = await this.prisma.affiliateReferral.findMany({
      where: { affiliateId: affiliate.id },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { tenant: { select: { name: true, affiliateCommission: { select: { amount: true, status: true } } } } },
    });
    const items: AffiliateReferralItem[] = rows.map((r) => {
      const commission = r.tenant?.affiliateCommission;
      const paid = !!commission && commission.status === AffiliateCommissionStatus.APPROVED;
      return {
        id: r.id,
        business: maskBusinessName(r.tenant?.name),
        signedUpAt: r.createdAt.toISOString(),
        status: paid ? 'PAID' : r.tenant ? 'BUSINESS_CREATED' : 'SIGNED_UP',
        commission: paid ? num(commission!.amount) : null,
      };
    });
    return { success: true as const, data: { items } };
  }

  async commissions(userId: string) {
    const affiliate = await this.requireOwn(userId);
    const rows = await this.prisma.affiliateCommission.findMany({
      where: { affiliateId: affiliate.id },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { tenant: { select: { name: true } } },
    });
    return { success: true as const, data: { items: rows.map((c) => this.toCommission(c, maskBusinessName(c.tenant.name))) } };
  }

  async payouts(userId: string) {
    const affiliate = await this.requireOwn(userId);
    const rows = await this.prisma.affiliatePayout.findMany({ where: { affiliateId: affiliate.id }, orderBy: { createdAt: 'desc' }, take: 200 });
    return { success: true as const, data: { items: rows.map((p) => this.toPayout(p)) } };
  }

  /** Withdraws the whole available balance to the affiliate's wallet number (paid by hand by the team). */
  async requestPayout(userId: string, req?: Request) {
    const program = await this.settings.get();
    const payout = await this.prisma.$transaction(async (tx) => {
      const own = await tx.affiliate.findUnique({ where: { userId } });
      if (!own) throw new NotFoundException('You are not an affiliate yet.');
      await tx.$queryRaw`SELECT id FROM affiliates WHERE id = ${own.id}::uuid FOR UPDATE`;
      const affiliate = await tx.affiliate.findUniqueOrThrow({ where: { id: own.id } });
      if (affiliate.status !== AffiliateStatus.ACTIVE) throw new ForbiddenException('Only active affiliates can withdraw.');
      if (!affiliate.payoutMethod || !affiliate.payoutNumber) {
        throw new BadRequestException({ message: 'Add your bKash, Nagad, Rocket or Upay number first.', error: 'AFFILIATE_PAYOUT_METHOD_MISSING' });
      }
      const open = await tx.affiliatePayout.count({ where: { affiliateId: affiliate.id, status: AffiliatePayoutStatus.REQUESTED } });
      if (open > 0) throw new ConflictException('You already have a withdrawal waiting to be paid.');
      const balance = await this.balance(affiliate.id, tx);
      if (balance.available < program.minPayout || balance.available <= 0) {
        throw new BadRequestException({
          message: `You can withdraw once you have at least ৳${program.minPayout} available. Available now: ৳${balance.available}.`,
          error: 'AFFILIATE_BELOW_MINIMUM',
        });
      }
      return tx.affiliatePayout.create({
        data: {
          affiliateId: affiliate.id,
          amount: new Prisma.Decimal(balance.available.toFixed(2)),
          method: affiliate.payoutMethod,
          number: affiliate.payoutNumber,
          accountName: affiliate.payoutName,
        },
      });
    });
    await this.audit.log({ action: 'AFFILIATE_PAYOUT_REQUESTED', entityType: 'AffiliatePayout', entityId: payout.id, userId, metadata: { amount: num(payout.amount) }, req });
    return { success: true as const, data: this.toPayout(payout) };
  }

  // ---------------------------------------------------------------------------
  // Referral tracking

  /** A visit through a referral link. Returns how long the browser should remember the code. */
  async click(code: string, ip: string) {
    const program = await this.settings.get();
    if (!program.enabled || !CODE_PATTERN.test(code)) return { success: true as const, data: { valid: false, cookieDays: program.cookieDays } };
    const affiliate = await this.prisma.affiliate.findUnique({ where: { code }, select: { id: true, status: true } });
    if (!affiliate || affiliate.status !== AffiliateStatus.ACTIVE) return { success: true as const, data: { valid: false, cookieDays: program.cookieDays } };
    // Counted at most a few times a day per visitor and code.
    if (await this.rateLimit.consume(`affiliate:click:${code}:${ip}`, 3, 24 * 60 * 60)) {
      await this.prisma.affiliate.update({ where: { id: affiliate.id }, data: { clickCount: { increment: 1 } } });
    }
    return { success: true as const, data: { valid: true, cookieDays: program.cookieDays } };
  }

  /** A new account that came through a referral link. Never fails sign-up. */
  async attachSignup(userId: string, code: string | null | undefined, db: Db = this.prisma): Promise<void> {
    const clean = code?.trim().toUpperCase();
    if (!clean || !CODE_PATTERN.test(clean)) return;
    try {
      const program = await this.settings.get(db);
      if (!program.enabled) return;
      const affiliate = await db.affiliate.findUnique({ where: { code: clean }, select: { id: true, userId: true, status: true } });
      if (!affiliate || affiliate.status !== AffiliateStatus.ACTIVE || affiliate.userId === userId) return;
      await db.affiliateReferral.createMany({ data: [{ affiliateId: affiliate.id, userId }], skipDuplicates: true });
    } catch (err) {
      this.logger.warn(`Referral not recorded for ${userId}: ${(err as Error).message}`);
    }
  }

  /** The referred user's first business becomes the referral's business. */
  async attachTenant(userId: string, tenantId: string, db: Db = this.prisma): Promise<void> {
    await db.affiliateReferral.updateMany({ where: { userId, tenantId: null }, data: { tenantId } });
  }

  /**
   * After a plan payment is approved: when it is the business's first approved
   * payment and the business came through an active affiliate (who is not part
   * of it), records the commission. Never throws.
   */
  async recordFirstPayment(billingPaymentId: string): Promise<void> {
    try {
      const program = await this.settings.get();
      if (!program.enabled) return;
      const payment = await this.prisma.billingPayment.findUnique({
        where: { id: billingPaymentId },
        select: { id: true, tenantId: true, amount: true, status: true, tenant: { select: { name: true } } },
      });
      if (!payment || payment.status !== BillingPaymentStatus.APPROVED) return;
      const approved = await this.prisma.billingPayment.count({ where: { tenantId: payment.tenantId, status: BillingPaymentStatus.APPROVED } });
      if (approved !== 1) return;
      const referral = await this.prisma.affiliateReferral.findUnique({ where: { tenantId: payment.tenantId }, include: { affiliate: true } });
      if (!referral || referral.affiliate.status !== AffiliateStatus.ACTIVE) return;
      const member = await this.prisma.tenantUser.count({ where: { tenantId: payment.tenantId, userId: referral.affiliate.userId } });
      if (member > 0) return;
      const rate = referral.affiliate.commissionRate ? num(referral.affiliate.commissionRate) : program.commissionRate;
      const paymentAmount = num(payment.amount);
      const amount = money((paymentAmount * rate) / 100);
      if (amount <= 0) return;
      const commission = await this.prisma.affiliateCommission.create({
        data: {
          affiliateId: referral.affiliateId,
          tenantId: payment.tenantId,
          billingPaymentId: payment.id,
          paymentAmount: new Prisma.Decimal(paymentAmount.toFixed(2)),
          rate: new Prisma.Decimal(rate.toFixed(2)),
          amount: new Prisma.Decimal(amount.toFixed(2)),
          availableAt: new Date(Date.now() + program.holdDays * DAY),
        },
      });
      await this.email.sendAffiliate(EMAIL_EVENTS.AFFILIATE_COMMISSION_EARNED, referral.affiliate.userId, commission.id, {
        amount,
        business: maskBusinessName(payment.tenant.name) ?? 'A business you referred',
        availableAt: commission.availableAt.toISOString(),
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return;
      this.logger.error(`Affiliate commission for payment ${billingPaymentId} failed: ${(err as Error).message}`);
    }
  }

  // ---------------------------------------------------------------------------
  // Super Admin

  async adminList(query: AdminAffiliateListQueryDto) {
    const program = await this.settings.get();
    const rows = await this.prisma.affiliate.findMany({
      where: query.status ? { status: query.status } : {},
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 300,
      include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
    });
    const items: AdminAffiliateItem[] = [];
    for (const a of rows) {
      items.push({
        ...this.toProfile(a, program),
        customRate: a.commissionRate ? num(a.commissionRate) : null,
        user: { id: a.user.id, email: a.user.email, name: [a.user.firstName, a.user.lastName].filter(Boolean).join(' ') || a.user.email },
        stats: await this.stats(a),
        balance: await this.balance(a.id),
      });
    }
    return { success: true as const, data: { items, program } };
  }

  async adminSetStatus(adminId: string, affiliateId: string, action: 'approve' | 'reject' | 'suspend' | 'reactivate', reason: string | null, req?: Request) {
    const affiliate = await this.prisma.affiliate.findUnique({ where: { id: affiliateId } });
    if (!affiliate) throw new NotFoundException('Affiliate not found');
    const allowed: Record<typeof action, AffiliateStatus[]> = {
      approve: [AffiliateStatus.PENDING, AffiliateStatus.REJECTED],
      reject: [AffiliateStatus.PENDING],
      suspend: [AffiliateStatus.ACTIVE],
      reactivate: [AffiliateStatus.SUSPENDED],
    };
    if (!allowed[action].includes(affiliate.status)) throw new ConflictException(`This affiliate is ${affiliate.status.toLowerCase()}.`);
    const status = action === 'approve' || action === 'reactivate' ? AffiliateStatus.ACTIVE : action === 'reject' ? AffiliateStatus.REJECTED : AffiliateStatus.SUSPENDED;
    const updated = await this.prisma.affiliate.update({
      where: { id: affiliate.id },
      data: { status, statusReason: status === AffiliateStatus.ACTIVE ? null : reason, reviewedByUserId: adminId, reviewedAt: new Date() },
    });
    await this.audit.log({ action: `AFFILIATE_${action.toUpperCase()}`, entityType: 'Affiliate', entityId: affiliate.id, userId: adminId, metadata: { code: affiliate.code, reason }, req });
    if (action === 'approve') {
      await this.email.sendAffiliate(EMAIL_EVENTS.AFFILIATE_APPROVED, affiliate.userId, affiliate.id, { code: affiliate.code, referralUrl: this.referralUrl(affiliate.code) });
    }
    return { success: true as const, data: this.toProfile(updated, await this.settings.get()) };
  }

  async adminSetRate(adminId: string, affiliateId: string, rate: number | null | undefined, req?: Request) {
    const affiliate = await this.prisma.affiliate.findUnique({ where: { id: affiliateId } });
    if (!affiliate) throw new NotFoundException('Affiliate not found');
    const updated = await this.prisma.affiliate.update({
      where: { id: affiliate.id },
      data: { commissionRate: rate == null ? null : new Prisma.Decimal(rate.toFixed(2)) },
    });
    await this.audit.log({ action: 'AFFILIATE_RATE_CHANGED', entityType: 'Affiliate', entityId: affiliate.id, userId: adminId, metadata: { rate: rate ?? null }, req });
    return { success: true as const, data: this.toProfile(updated, await this.settings.get()) };
  }

  async adminCommissions() {
    const rows = await this.prisma.affiliateCommission.findMany({
      orderBy: { createdAt: 'desc' },
      take: 300,
      include: { tenant: { select: { id: true, name: true } }, affiliate: { select: { id: true, code: true, user: { select: { email: true } } } } },
    });
    const items: AdminAffiliateCommissionItem[] = rows.map((c) => ({
      ...this.toCommission(c, c.tenant.name),
      affiliate: { id: c.affiliate.id, code: c.affiliate.code, email: c.affiliate.user.email },
      tenant: { id: c.tenant.id, name: c.tenant.name },
    }));
    return { success: true as const, data: { items } };
  }

  /** Commissions can be rejected while they are on hold (that is what the hold is for). */
  async adminRejectCommission(adminId: string, commissionId: string, reason: string, req?: Request) {
    const commission = await this.prisma.affiliateCommission.findUnique({ where: { id: commissionId } });
    if (!commission) throw new NotFoundException('Commission not found');
    if (commission.status === AffiliateCommissionStatus.REJECTED) throw new ConflictException('This commission was already rejected.');
    if (commission.availableAt.getTime() <= Date.now()) {
      throw new ConflictException('This commission is past its hold period and may already be withdrawn.');
    }
    const updated = await this.prisma.affiliateCommission.update({
      where: { id: commission.id },
      data: { status: AffiliateCommissionStatus.REJECTED, rejectionReason: reason, reviewedByUserId: adminId },
    });
    await this.audit.log({ action: 'AFFILIATE_COMMISSION_REJECTED', entityType: 'AffiliateCommission', entityId: commission.id, userId: adminId, metadata: { reason }, req });
    return { success: true as const, data: this.toCommission(updated, null) };
  }

  async adminPayouts(query: AdminPayoutListQueryDto) {
    const rows = await this.prisma.affiliatePayout.findMany({
      where: query.status ? { status: query.status } : {},
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 300,
      include: { affiliate: { select: { id: true, code: true, user: { select: { email: true, firstName: true, lastName: true } } } } },
    });
    const items: AdminAffiliatePayoutItem[] = rows.map((p) => ({
      ...this.toPayout(p),
      affiliate: {
        id: p.affiliate.id,
        code: p.affiliate.code,
        email: p.affiliate.user.email,
        name: [p.affiliate.user.firstName, p.affiliate.user.lastName].filter(Boolean).join(' ') || p.affiliate.user.email,
      },
    }));
    return { success: true as const, data: { items } };
  }

  async adminMarkPayout(adminId: string, payoutId: string, outcome: { paid: string } | { rejected: string }, req?: Request) {
    const data: Prisma.AffiliatePayoutUpdateManyMutationInput =
      'paid' in outcome
        ? { status: AffiliatePayoutStatus.PAID, transactionId: outcome.paid, reviewedByUserId: adminId, reviewedAt: new Date() }
        : { status: AffiliatePayoutStatus.REJECTED, rejectionReason: outcome.rejected, reviewedByUserId: adminId, reviewedAt: new Date() };
    const changed = await this.prisma.affiliatePayout.updateMany({ where: { id: payoutId, status: AffiliatePayoutStatus.REQUESTED }, data });
    const payout = await this.prisma.affiliatePayout.findUnique({ where: { id: payoutId }, include: { affiliate: { select: { userId: true } } } });
    if (!payout) throw new NotFoundException('Payout not found');
    if (changed.count === 0) throw new ConflictException(`This withdrawal was already ${payout.status.toLowerCase()}.`);
    await this.audit.log({
      action: 'paid' in outcome ? 'AFFILIATE_PAYOUT_PAID' : 'AFFILIATE_PAYOUT_REJECTED',
      entityType: 'AffiliatePayout',
      entityId: payout.id,
      userId: adminId,
      metadata: 'paid' in outcome ? { transactionId: outcome.paid, amount: num(payout.amount) } : { reason: outcome.rejected },
      req,
    });
    await this.email.sendAffiliate('paid' in outcome ? EMAIL_EVENTS.AFFILIATE_PAYOUT_PAID : EMAIL_EVENTS.AFFILIATE_PAYOUT_REJECTED, payout.affiliate.userId, payout.id, {
      amount: num(payout.amount),
      method: payout.method,
      number: payout.number,
      transactionId: payout.transactionId,
      reason: payout.rejectionReason,
    });
    return { success: true as const, data: this.toPayout(payout) };
  }

  adminSettings() {
    return this.settings.get().then((data) => ({ success: true as const, data }));
  }

  async adminUpdateSettings(adminId: string, dto: AffiliateSettingsDto, req?: Request) {
    const data = await this.settings.update(dto);
    await this.audit.log({ action: 'AFFILIATE_SETTINGS_UPDATED', entityType: 'PlatformSetting', entityId: 'affiliate', userId: adminId, metadata: { ...data }, req });
    return { success: true as const, data };
  }

  // ---------------------------------------------------------------------------

  /** Earned commissions (past the hold) minus withdrawals paid or waiting. */
  async balance(affiliateId: string, db: Db = this.prisma): Promise<AffiliateBalance> {
    const now = new Date();
    const [ready, held, paid, requested] = await Promise.all([
      db.affiliateCommission.aggregate({ where: { affiliateId, status: AffiliateCommissionStatus.APPROVED, availableAt: { lte: now } }, _sum: { amount: true } }),
      db.affiliateCommission.aggregate({ where: { affiliateId, status: AffiliateCommissionStatus.APPROVED, availableAt: { gt: now } }, _sum: { amount: true } }),
      db.affiliatePayout.aggregate({ where: { affiliateId, status: AffiliatePayoutStatus.PAID }, _sum: { amount: true } }),
      db.affiliatePayout.aggregate({ where: { affiliateId, status: AffiliatePayoutStatus.REQUESTED }, _sum: { amount: true } }),
    ]);
    const readyAmount = num(ready._sum.amount);
    const onHold = num(held._sum.amount);
    const paidAmount = num(paid._sum.amount);
    const requestedAmount = num(requested._sum.amount);
    return {
      available: money(Math.max(0, readyAmount - paidAmount - requestedAmount)),
      onHold: money(onHold),
      requested: money(requestedAmount),
      paid: money(paidAmount),
      totalEarned: money(readyAmount + onHold),
    };
  }

  private async stats(affiliate: Affiliate): Promise<AffiliateStats> {
    const [signups, businesses, paidCustomers] = await Promise.all([
      this.prisma.affiliateReferral.count({ where: { affiliateId: affiliate.id } }),
      this.prisma.affiliateReferral.count({ where: { affiliateId: affiliate.id, tenantId: { not: null } } }),
      this.prisma.affiliateCommission.count({ where: { affiliateId: affiliate.id, status: AffiliateCommissionStatus.APPROVED } }),
    ]);
    return { clicks: affiliate.clickCount, signups, businesses, paidCustomers };
  }

  private referralUrl(code: string): string {
    return `${this.emailConfig.appPublicUrl()}/?ref=${encodeURIComponent(code)}`;
  }

  private async requireOwn(userId: string): Promise<Affiliate> {
    const affiliate = await this.prisma.affiliate.findUnique({ where: { userId } });
    if (!affiliate) throw new NotFoundException('You are not an affiliate yet.');
    return affiliate;
  }

  /** A readable code from the name (letters) and 4 digits, e.g. RAHIM4821; retried on a clash. */
  private async createWithCode(userId: string, name: string, applicationNote: string | null): Promise<Affiliate> {
    const letters = name.toUpperCase().normalize('NFKD').replace(/[^A-Z]/g, '').slice(0, 6) || 'ECO';
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const code = `${letters}${randomInt(1000, 10000)}`;
      try {
        return await this.prisma.affiliate.create({ data: { userId, code, applicationNote } });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          const own = await this.prisma.affiliate.findUnique({ where: { userId } });
          if (own) return own;
          continue;
        }
        throw err;
      }
    }
    throw new ConflictException('Could not create a referral code. Please try again.');
  }

  private toProfile(a: Affiliate, program: AffiliateProgramSettings): AffiliateProfile {
    return {
      id: a.id,
      code: a.code,
      status: a.status,
      statusReason: a.statusReason,
      applicationNote: a.applicationNote,
      commissionRate: a.commissionRate ? num(a.commissionRate) : program.commissionRate,
      payoutMethod: a.payoutMethod,
      payoutNumber: a.payoutNumber,
      payoutName: a.payoutName,
      createdAt: a.createdAt.toISOString(),
      reviewedAt: a.reviewedAt?.toISOString() ?? null,
    };
  }

  private toCommission(c: AffiliateCommission, business: string | null): AffiliateCommissionItem {
    return {
      id: c.id,
      business,
      paymentAmount: num(c.paymentAmount),
      rate: num(c.rate),
      amount: num(c.amount),
      status: c.status,
      availableAt: c.availableAt.toISOString(),
      rejectionReason: c.rejectionReason,
      createdAt: c.createdAt.toISOString(),
    };
  }

  private toPayout(p: AffiliatePayout): AffiliatePayoutItem {
    return {
      id: p.id,
      amount: num(p.amount),
      method: p.method,
      number: p.number,
      accountName: p.accountName,
      status: p.status,
      transactionId: p.transactionId,
      rejectionReason: p.rejectionReason,
      createdAt: p.createdAt.toISOString(),
      reviewedAt: p.reviewedAt?.toISOString() ?? null,
    };
  }
}
