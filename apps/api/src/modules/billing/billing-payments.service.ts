import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BillingPaymentStatus,
  Prisma,
  SubscriptionStatus,
  TenantRole,
  type BillingCycle,
  type ManualPaymentMethod,
  type SubscriptionPlan,
} from '@prisma/client';
import type { Request } from 'express';
import type {
  AdminBillingPayment,
  ManualPaymentAccount,
  MerchantBillingPayment,
} from '@ecomesta/types';
import { addCalendarMonths, billingCycleDefinition, billingCyclePrice } from '@ecomesta/utils';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthorizationService } from '../authorization/authorization.service';
import { EMAIL_EVENTS, type BillingPaymentParams } from '../email/email.events';
import { EmailService } from '../email/email.service';
import { BillingService } from './billing.service';
import { PAYMENT_INCLUDE, toMerchantBillingPayment, type PaymentRow } from './billing-payment.mapper';
import { planMonthlyPrice } from './plan-catalog';
import { SubscriptionLifecycleService } from './subscription-lifecycle.service';

/** Ecomesta's personal wallets that merchants "Send Money" to. */
export const MANUAL_PAYMENT_ACCOUNTS: readonly ManualPaymentAccount[] = [
  { method: 'BKASH', label: 'bKash', number: '01309093407', transferType: 'Send Money' },
  { method: 'NAGAD', label: 'Nagad', number: '01309093407', transferType: 'Send Money' },
  { method: 'ROCKET', label: 'Rocket', number: '01757591788', transferType: 'Send Money' },
  { method: 'UPAY', label: 'Upay', number: '01318090622', transferType: 'Send Money' },
];

/** Bangladeshi mobile number: 01XXXXXXXXX (an optional +88 / 88 prefix is dropped). */
export function normalizeBdMobile(value: string): string | null {
  const digits = value.replace(/[\s\-().]/g, '').replace(/^\+?88/, '');
  return /^01[3-9]\d{8}$/.test(digits) ? digits : null;
}

/** Wallet transaction IDs are letters and digits; compared case-insensitively. */
export function normalizeTransactionId(value: string): string | null {
  const id = value.replace(/\s+/g, '').toUpperCase();
  return /^[A-Z0-9]{6,30}$/.test(id) ? id : null;
}

export interface WalletPaymentDetails {
  method: ManualPaymentMethod;
  senderNumber: string;
  transactionId: string;
}

export interface PreparedWalletPayment {
  method: ManualPaymentMethod;
  account: ManualPaymentAccount;
  senderNumber: string;
  transactionId: string;
}

/** Checks the wallet details a merchant typed; throws 400 with the message they see. */
export function prepareWalletPayment(input: WalletPaymentDetails): PreparedWalletPayment {
  const account = MANUAL_PAYMENT_ACCOUNTS.find((item) => item.method === input.method);
  if (!account) throw new BadRequestException('Choose bKash, Nagad, Rocket or Upay');
  const senderNumber = normalizeBdMobile(input.senderNumber);
  if (!senderNumber) {
    throw new BadRequestException('Enter the 11-digit mobile number you paid from, e.g. 01712345678');
  }
  const transactionId = normalizeTransactionId(input.transactionId);
  if (!transactionId) {
    throw new BadRequestException('Enter the transaction ID from your payment message (letters and numbers)');
  }
  return { method: input.method, account, senderNumber, transactionId };
}

/** Turns a unique-constraint error on billing payments into the 409 merchants see. */
export function billingPaymentConflict(err: unknown): ConflictException | null {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== 'P2002') return null;
  const target = JSON.stringify(err.meta?.target ?? '');
  return new ConflictException(
    target.includes('transaction')
      ? 'This transaction ID has already been submitted. Check the ID in your payment message.'
      : 'You already have a payment waiting for review. We will confirm it shortly.',
  );
}



@Injectable()
export class BillingPaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
    private readonly audit: AuditService,
    private readonly email: EmailService,
    private readonly billing: BillingService,
    private readonly lifecycle: SubscriptionLifecycleService,
  ) {}

  accounts(): { success: true; data: ManualPaymentAccount[] } {
    return { success: true, data: [...MANUAL_PAYMENT_ACCOUNTS] };
  }

  /**
   * Records a payment the merchant made by mobile wallet. Nothing is unlocked
   * here: the plan only changes when a Super Admin approves the payment.
   */
  async submit(
    userId: string,
    input: {
      planSlug: string;
      billingCycle: BillingCycle;
      method: ManualPaymentMethod;
      senderNumber: string;
      transactionId: string;
      tenant?: string;
    },
    req?: Request,
  ): Promise<{ success: true; data: MerchantBillingPayment }> {
    const tenant = await this.billing.resolveTenant(userId, input.tenant);
    await this.authorization.assertTenantRole(userId, tenant.id, [TenantRole.OWNER, TenantRole.ADMIN]);
    const plan = await this.billing.requireActivePlan(input.planSlug);
    const prepared = prepareWalletPayment(input);

    const existingPending = await this.prisma.billingPayment.findFirst({
      where: { tenantId: tenant.id, status: BillingPaymentStatus.PENDING },
      select: { id: true },
    });
    if (existingPending) {
      throw new ConflictException('You already have a payment waiting for review. We will confirm it shortly.');
    }

    let created: PaymentRow;
    try {
      created = await this.prisma.$transaction((tx) =>
        this.createPending(tx, { tenantId: tenant.id, userId, plan, billingCycle: input.billingCycle, prepared }),
      );
    } catch (err) {
      throw billingPaymentConflict(err) ?? err;
    }
    this.email.dispatchPending();
    await this.auditSubmitted(created, plan, userId, req);
    return { success: true, data: this.toMerchantDto(created) };
  }

  /**
   * Stores a payment waiting for review and queues the billing-inbox email,
   * inside the caller's transaction (also used by onboarding, where the
   * store is created in the same transaction). The amount always comes from
   * the plan, never from the client.
   */
  async createPending(
    tx: Prisma.TransactionClient,
    params: {
      tenantId: string;
      userId: string;
      plan: SubscriptionPlan;
      billingCycle: BillingCycle;
      prepared: PreparedWalletPayment;
    },
  ): Promise<PaymentRow> {
    const amount = billingCyclePrice(planMonthlyPrice(params.plan), params.billingCycle);
    const row = await tx.billingPayment.create({
      data: {
        tenantId: params.tenantId,
        planId: params.plan.id,
        billingCycle: params.billingCycle,
        amount,
        method: params.prepared.method,
        payToNumber: params.prepared.account.number,
        senderNumber: params.prepared.senderNumber,
        transactionId: params.prepared.transactionId,
        submittedByUserId: params.userId,
      },
      include: PAYMENT_INCLUDE,
    });
    await this.email.sendBillingPayment(
      EMAIL_EVENTS.BILLING_PAYMENT_SUBMITTED,
      { userId: params.userId, tenantId: params.tenantId },
      this.emailParams(row),
      tx,
    );
    return row;
  }

  async auditSubmitted(row: PaymentRow, plan: SubscriptionPlan, userId: string, req?: Request): Promise<void> {
    await this.audit.log({
      action: 'BILLING_PAYMENT_SUBMITTED',
      entityType: 'BillingPayment',
      entityId: row.id,
      tenantId: row.tenantId,
      userId,
      metadata: {
        planSlug: plan.slug,
        billingCycle: row.billingCycle,
        amount: Number(row.amount),
        method: row.method,
      },
      req,
    });
  }

  async listForTenant(
    userId: string,
    tenantSlug?: string,
  ): Promise<{ success: true; data: MerchantBillingPayment[] }> {
    const tenant = await this.billing.resolveTenant(userId, tenantSlug);
    const rows = await this.prisma.billingPayment.findMany({
      where: { tenantId: tenant.id },
      include: PAYMENT_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return { success: true, data: rows.map((row) => this.toMerchantDto(row)) };
  }

  async pendingForTenant(tenantId: string): Promise<MerchantBillingPayment | null> {
    const row = await this.prisma.billingPayment.findFirst({
      where: { tenantId, status: BillingPaymentStatus.PENDING },
      include: PAYMENT_INCLUDE,
    });
    return row ? this.toMerchantDto(row) : null;
  }

  async adminList(query: { status?: BillingPaymentStatus; page?: number; limit?: number }) {
    const limit = Math.min(Math.max(query.limit ?? 20, 1), 100);
    const page = Math.max(query.page ?? 1, 1);
    const where: Prisma.BillingPaymentWhereInput = query.status ? { status: query.status } : {};
    const [rows, total, pending] = await Promise.all([
      this.prisma.billingPayment.findMany({
        where,
        include: PAYMENT_INCLUDE,
        // Oldest pending first: payments are checked in the order they arrived.
        orderBy:
          query.status === BillingPaymentStatus.PENDING ? { createdAt: 'asc' } : { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.billingPayment.count({ where }),
      this.prisma.billingPayment.count({ where: { status: BillingPaymentStatus.PENDING } }),
    ]);
    const items: AdminBillingPayment[] = [];
    for (const row of rows) items.push(await this.toAdminDto(row));
    return {
      success: true as const,
      data: {
        items,
        pendingCount: pending,
        meta: { total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) },
      },
    };
  }

  /**
   * Confirms a payment and gives the business the plan it paid for.
   * - Trial / payment due / suspended: switches to the paid plan and activates
   *   it through SubscriptionLifecycleService (a trial payment starts the paid
   *   period when the trial ends; suspended stores reopen).
   * - Already paid: same plan and cycle extends the paid period; a different
   *   plan or cycle starts a new period today.
   * Safe to repeat: approving an approved payment only finishes activation.
   */
  async approve(adminUserId: string, paymentId: string, req?: Request) {
    const step = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM billing_payments WHERE id = ${paymentId}::uuid FOR UPDATE`;
      const payment = await tx.billingPayment.findUnique({
        where: { id: paymentId },
        include: { plan: true },
      });
      if (!payment) throw new NotFoundException('Payment not found');
      if (payment.status === BillingPaymentStatus.REJECTED) {
        throw new ConflictException('This payment was rejected and cannot be approved');
      }
      if (payment.status === BillingPaymentStatus.APPROVED) {
        return { payment, subscriptionId: payment.subscriptionId, activate: true, firstApproval: false };
      }

      const current = await this.lifecycle.currentForTenant(payment.tenantId, tx);
      const { months } = billingCycleDefinition(payment.billingCycle);
      const now = new Date();
      let subscriptionId: string;
      let activate = true;

      if (!current) {
        const created = await tx.subscription.create({
          data: {
            tenantId: payment.tenantId,
            planId: payment.planId,
            billingCycle: payment.billingCycle,
            status: SubscriptionStatus.PAST_DUE,
            startsAt: now,
          },
        });
        subscriptionId = created.id;
      } else if (current.status === SubscriptionStatus.ACTIVE) {
        const samePlan = current.planId === payment.planId && current.billingCycle === payment.billingCycle;
        const from =
          samePlan && current.endsAt && current.endsAt.getTime() > now.getTime() ? current.endsAt : now;
        await tx.subscription.update({
          where: { id: current.id },
          data: {
            planId: payment.planId,
            billingCycle: payment.billingCycle,
            endsAt: addCalendarMonths(from, months),
          },
        });
        subscriptionId = current.id;
        activate = false;
      } else {
        await tx.subscription.update({
          where: { id: current.id },
          data: { planId: payment.planId, billingCycle: payment.billingCycle },
        });
        subscriptionId = current.id;
      }

      const approved = await tx.billingPayment.update({
        where: { id: payment.id },
        data: {
          status: BillingPaymentStatus.APPROVED,
          reviewedByUserId: adminUserId,
          reviewedAt: now,
          subscriptionId,
        },
        include: { plan: true },
      });
      return { payment: approved, subscriptionId, activate, firstApproval: true };
    });

    if (step.activate && step.subscriptionId) {
      await this.lifecycle.activateAfterConfirmedPayment({
        subscriptionId: step.subscriptionId,
        source: 'ADMIN_CONFIRMED',
        actorUserId: adminUserId,
        req,
      });
    }

    const row = await this.prisma.billingPayment.findUniqueOrThrow({
      where: { id: paymentId },
      include: PAYMENT_INCLUDE,
    });
    if (step.firstApproval) {
      const subscription = step.subscriptionId
        ? await this.prisma.subscription.findUnique({
            where: { id: step.subscriptionId },
            select: { endsAt: true },
          })
        : null;
      await this.email.sendBillingPayment(
        EMAIL_EVENTS.BILLING_PAYMENT_APPROVED,
        { userId: row.submittedByUserId, tenantId: row.tenantId },
        { ...this.emailParams(row), paidThrough: subscription?.endsAt?.toISOString() ?? null },
      );
      await this.audit.log({
        action: 'BILLING_PAYMENT_APPROVED',
        entityType: 'BillingPayment',
        entityId: row.id,
        tenantId: row.tenantId,
        userId: adminUserId,
        metadata: {
          planSlug: row.plan.slug,
          billingCycle: row.billingCycle,
          amount: Number(row.amount),
          subscriptionId: step.subscriptionId,
        },
        req,
      });
    }
    return { success: true as const, data: await this.toAdminDto(row) };
  }

  async reject(adminUserId: string, paymentId: string, reason: string, req?: Request) {
    const trimmed = reason.trim();
    if (trimmed.length < 3) {
      throw new BadRequestException('Tell the merchant why the payment could not be confirmed');
    }
    const outcome = await this.prisma.billingPayment.updateMany({
      where: { id: paymentId, status: BillingPaymentStatus.PENDING },
      data: {
        status: BillingPaymentStatus.REJECTED,
        reviewedByUserId: adminUserId,
        reviewedAt: new Date(),
        rejectionReason: trimmed.slice(0, 500),
      },
    });
    const row = await this.prisma.billingPayment.findUnique({
      where: { id: paymentId },
      include: PAYMENT_INCLUDE,
    });
    if (!row) throw new NotFoundException('Payment not found');
    if (outcome.count === 0) {
      throw new ConflictException(
        row.status === BillingPaymentStatus.APPROVED
          ? 'This payment was already approved'
          : 'This payment was already rejected',
      );
    }
    await this.email.sendBillingPayment(
      EMAIL_EVENTS.BILLING_PAYMENT_REJECTED,
      { userId: row.submittedByUserId, tenantId: row.tenantId },
      { ...this.emailParams(row), rejectionReason: row.rejectionReason },
    );
    await this.audit.log({
      action: 'BILLING_PAYMENT_REJECTED',
      entityType: 'BillingPayment',
      entityId: row.id,
      tenantId: row.tenantId,
      userId: adminUserId,
      metadata: { reason: row.rejectionReason },
      req,
    });
    return { success: true as const, data: await this.toAdminDto(row) };
  }

  private emailParams(row: {
    id: string;
    amount: Prisma.Decimal;
    billingCycle: BillingCycle;
    method: ManualPaymentMethod;
    payToNumber: string;
    senderNumber: string;
    transactionId: string;
    createdAt: Date;
    plan: { name: string };
    tenant?: { name: string };
  }): BillingPaymentParams {
    return {
      paymentId: row.id,
      businessName: row.tenant?.name ?? '',
      planName: row.plan.name,
      billingCycle: row.billingCycle,
      amount: Number(row.amount),
      method: row.method,
      payToNumber: row.payToNumber,
      senderNumber: row.senderNumber,
      transactionId: row.transactionId,
      submittedAt: row.createdAt.toISOString(),
    };
  }

  toMerchantDto(row: PaymentRow): MerchantBillingPayment {
    return toMerchantBillingPayment(row);
  }

  private async toAdminDto(row: PaymentRow): Promise<AdminBillingPayment> {
    const current = await this.lifecycle.currentForTenant(row.tenantId);
    const name = [row.submittedBy.firstName, row.submittedBy.lastName].filter(Boolean).join(' ');
    return {
      ...this.toMerchantDto(row),
      payToNumber: row.payToNumber,
      tenant: row.tenant,
      submittedBy: { id: row.submittedBy.id, email: row.submittedBy.email, name: name || null },
      reviewedBy: row.reviewedBy,
      currentSubscription: current ? { status: current.status, planName: current.plan.name } : null,
    };
  }
}
