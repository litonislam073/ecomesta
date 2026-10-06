import type { INestApplication } from '@nestjs/common';
import type { Response } from 'supertest';
import { BillingPaymentsService } from '../../src/modules/billing/billing-payments.service';
import { PrismaService } from '../../src/prisma/prisma.service';

let sequence = 0;

/** A wallet transaction ID no other test run has used (letters and digits, 6–30). */
export function uniqueTransactionId(): string {
  sequence += 1;
  const random = Math.floor(Math.random() * 36 ** 4).toString(36);
  return `T${Date.now().toString(36)}${process.pid.toString(36)}${sequence.toString(36)}${random}`.toUpperCase().slice(0, 30);
}

/**
 * Onboarding now ends with the first subscription payment. Adds the plan and
 * wallet details a merchant would send; the test's own fields win, so a test
 * can choose the plan, billing period or an invalid payment on purpose.
 * Defaults to Business, which has every feature and no product limit.
 */
export function withPayment<T extends object>(body: T) {
  return {
    planSlug: 'business',
    billingCycle: 'MONTHLY' as const,
    method: 'BKASH' as const,
    senderNumber: '01712345678',
    transactionId: uniqueTransactionId(),
    ...body,
  };
}

/**
 * Confirms the sign-up payment the way a Super Admin approval does
 * (BillingPaymentsService.approve), which brings the new store online.
 * For use as `.then(activateOnboarded(app))` after an onboarding request.
 */
export function activateOnboarded(app: INestApplication) {
  return async (res: Response): Promise<Response> => {
    const paymentId = (res.body as { data?: { payment?: { id?: string } } }).data?.payment?.id;
    if (!paymentId) throw new Error(`Onboarding response has no payment: ${JSON.stringify(res.body)}`);
    const payment = await app.get(PrismaService).billingPayment.findUniqueOrThrow({
      where: { id: paymentId },
      select: { submittedByUserId: true },
    });
    await app.get(BillingPaymentsService).approve(payment.submittedByUserId, paymentId);
    return res;
  };
}
