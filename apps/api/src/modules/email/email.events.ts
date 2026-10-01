/** Every transactional email the platform can send, active or planned. */
export const EMAIL_EVENTS = {
  MERCHANT_WELCOME: 'MERCHANT_WELCOME',
  EMAIL_VERIFICATION: 'EMAIL_VERIFICATION',
  STORE_CREATED: 'STORE_CREATED',
  PASSWORD_RESET: 'PASSWORD_RESET',
  PASSWORD_CHANGED: 'PASSWORD_CHANGED',
  SECURITY_NOTIFICATION: 'SECURITY_NOTIFICATION',
  SUPPORT_REQUEST: 'SUPPORT_REQUEST',
  // Manual subscription payments (bKash / Nagad / Rocket / Upay).
  BILLING_PAYMENT_SUBMITTED: 'BILLING_PAYMENT_SUBMITTED',
  BILLING_PAYMENT_APPROVED: 'BILLING_PAYMENT_APPROVED',
  BILLING_PAYMENT_REJECTED: 'BILLING_PAYMENT_REJECTED',
  // A website visitor asked the AI support agent for a person.
  AI_SUPPORT_HANDOFF: 'AI_SUPPORT_HANDOFF',
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

/** A manual subscription payment, as shown in billing emails. */
export interface BillingPaymentParams {
  paymentId: string;
  businessName: string;
  planName: string;
  billingCycle: string;
  amount: number;
  method: string;
  payToNumber: string;
  senderNumber: string;
  transactionId: string;
  submittedAt: string;
  /** Approval: the date the paid plan runs until. */
  paidThrough?: string | null;
  /** Rejection: why the payment could not be confirmed. */
  rejectionReason?: string | null;
}

/** A website visitor's request for human help, raised from the AI support chat. */
export interface AiSupportHandoffParams {
  reference: string;
  name: string;
  /** Always given by new requests; absent on ones queued before phone was required. */
  phone?: string | null;
  /** Optional: when missing, the team calls or messages the phone number instead. */
  email: string | null;
  message: string;
  /** What the AI agent understood the visitor needs. */
  reason: string | null;
  language: string;
  submittedAt: string;
  /** Recent chat turns for context (already trimmed). */
  transcript: { role: 'user' | 'assistant'; content: string }[];
}

/**
 * Template data persisted in the outbox. Everything here must be safe to keep
 * in the database until delivery: no passwords, tokens or token-bearing URLs.
 */
export type OutboxEmail =
  | { event: typeof EMAIL_EVENTS.MERCHANT_WELCOME; params: MerchantWelcomeParams }
  | { event: typeof EMAIL_EVENTS.STORE_CREATED; params: StoreCreatedParams }
  | { event: typeof EMAIL_EVENTS.PASSWORD_CHANGED; params: PasswordChangedParams }
  | { event: typeof EMAIL_EVENTS.SUPPORT_REQUEST; params: SupportRequestParams }
  | { event: typeof EMAIL_EVENTS.BILLING_PAYMENT_SUBMITTED; params: BillingPaymentParams }
  | { event: typeof EMAIL_EVENTS.BILLING_PAYMENT_APPROVED; params: BillingPaymentParams }
  | { event: typeof EMAIL_EVENTS.BILLING_PAYMENT_REJECTED; params: BillingPaymentParams }
  | { event: typeof EMAIL_EVENTS.AI_SUPPORT_HANDOFF; params: AiSupportHandoffParams };
