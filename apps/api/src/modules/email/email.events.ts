/** Every transactional email the platform can send, active or planned. */
export const EMAIL_EVENTS = {
  MERCHANT_WELCOME: 'MERCHANT_WELCOME',
  EMAIL_VERIFICATION: 'EMAIL_VERIFICATION',
  STORE_CREATED: 'STORE_CREATED',
  PASSWORD_RESET: 'PASSWORD_RESET',
  PASSWORD_CHANGED: 'PASSWORD_CHANGED',
  SECURITY_NOTIFICATION: 'SECURITY_NOTIFICATION',
  SUPPORT_REQUEST: 'SUPPORT_REQUEST',
  // Billing lifecycle — reserved, not sent yet.
  TRIAL_STARTED: 'TRIAL_STARTED',
  TRIAL_ENDING: 'TRIAL_ENDING',
  PAYMENT_SUCCESS: 'PAYMENT_SUCCESS',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  SUBSCRIPTION_ACTIVATED: 'SUBSCRIPTION_ACTIVATED',
  SUBSCRIPTION_PAST_DUE: 'SUBSCRIPTION_PAST_DUE',
  STORE_SUSPENDED: 'STORE_SUSPENDED',
  STORE_REACTIVATED: 'STORE_REACTIVATED',
  INVOICE_CREATED: 'INVOICE_CREATED',
} as const;

export type EmailEvent = (typeof EMAIL_EVENTS)[keyof typeof EMAIL_EVENTS];

export interface MerchantWelcomeParams {
  firstName: string | null;
}

export interface StoreCreatedParams {
  firstName: string | null;
  storeName: string;
  storeSlug: string;
  planName: string | null;
  billingCycle: string | null;
  trialEndsAt: string | null;
}

export interface PasswordChangedParams {
  firstName: string | null;
  changedAt: string;
}

export interface SupportRequestParams {
  category: string;
  subject: string;
  message: string;
  storeName: string | null;
}

/**
 * Template data persisted in the outbox. Everything here must be safe to keep
 * in the database until delivery: no passwords, tokens or token-bearing URLs.
 */
export type OutboxEmail =
  | { event: typeof EMAIL_EVENTS.MERCHANT_WELCOME; params: MerchantWelcomeParams }
  | { event: typeof EMAIL_EVENTS.STORE_CREATED; params: StoreCreatedParams }
  | { event: typeof EMAIL_EVENTS.PASSWORD_CHANGED; params: PasswordChangedParams }
  | { event: typeof EMAIL_EVENTS.SUPPORT_REQUEST; params: SupportRequestParams };
