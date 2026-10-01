import type { Prisma } from '@prisma/client';
import type { MerchantBillingPayment } from '@ecomesta/types';

/** Relations every billing payment view needs. */
export const PAYMENT_INCLUDE = {
  plan: { select: { name: true, slug: true } },
  tenant: { select: { id: true, name: true, slug: true } },
  submittedBy: { select: { id: true, email: true, firstName: true, lastName: true } },
  reviewedBy: { select: { id: true, email: true } },
} satisfies Prisma.BillingPaymentInclude;

export type PaymentRow = Prisma.BillingPaymentGetPayload<{ include: typeof PAYMENT_INCLUDE }>;

/** Merchant-facing view: no internal user ids. */
export function toMerchantBillingPayment(row: PaymentRow): MerchantBillingPayment {
  return {
    id: row.id,
    planName: row.plan.name,
    planSlug: row.plan.slug,
    billingCycle: row.billingCycle,
    amount: Number(row.amount),
    currency: 'BDT',
    method: row.method,
    senderNumber: row.senderNumber,
    transactionId: row.transactionId,
    status: row.status,
    rejectionReason: row.rejectionReason,
    createdAt: row.createdAt.toISOString(),
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
  };
}
