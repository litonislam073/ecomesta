import {
  BadRequestException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { SubscriptionStatus } from '@prisma/client';

export const SUBSCRIPTION_TRANSITIONS: Record<
  SubscriptionStatus,
  SubscriptionStatus[]
> = {
  [SubscriptionStatus.TRIALING]: [
    SubscriptionStatus.ACTIVE,
    SubscriptionStatus.PAST_DUE,
    SubscriptionStatus.CANCELLED,
    SubscriptionStatus.EXPIRED,
  ],
  [SubscriptionStatus.ACTIVE]: [
    SubscriptionStatus.PAST_DUE,
    SubscriptionStatus.CANCELLED,
    SubscriptionStatus.EXPIRED,
  ],
  [SubscriptionStatus.PAST_DUE]: [
    SubscriptionStatus.ACTIVE,
    SubscriptionStatus.CANCELLED,
    SubscriptionStatus.EXPIRED,
  ],
  // Reactivation is the only way out of a terminal state.
  [SubscriptionStatus.CANCELLED]: [SubscriptionStatus.ACTIVE],
  [SubscriptionStatus.EXPIRED]: [SubscriptionStatus.ACTIVE],
};

export function isValidSubscriptionTransition(
  from: SubscriptionStatus,
  to: SubscriptionStatus,
): boolean {
  return (SUBSCRIPTION_TRANSITIONS[from] ?? []).includes(to);
}

export function assertSubscriptionStatusTransition(
  from: SubscriptionStatus,
  to: SubscriptionStatus,
): void {
  if (from === to) {
    throw new BadRequestException(`subscription is already ${from}`);
  }
  if (!isValidSubscriptionTransition(from, to)) {
    throw new UnprocessableEntityException(
      `Invalid subscription status transition from ${from} to ${to}`,
    );
  }
}
