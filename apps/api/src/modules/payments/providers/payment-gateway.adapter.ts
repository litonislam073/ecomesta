import {
  PaymentMethod,
  PaymentProvider,
  PaymentStatus,
  Prisma,
} from '@prisma/client';

export type ProviderCreatePaymentInput = {
  storeId: string;
  orderId: string;
  paymentId: string;
  internalReference: string;
  amount: Prisma.Decimal;
  currency: string;
  method: PaymentMethod;
  returnUrls: {
    success: string;
    cancel: string;
    failure: string;
  };
  customer?: {
    email?: string | null;
    name?: string | null;
    phone?: string | null;
    addressLine1?: string | null;
    city?: string | null;
    postalCode?: string | null;
    country?: string | null;
  };
  publicConfig: Record<string, unknown>;
  secrets: Record<string, unknown>;
  mode: 'test' | 'live';
};

export type ProviderCreatePaymentResult = {
  providerPaymentId: string | null;
  redirectUrl: string | null;
  clientPayload?: Record<string, unknown>;
};

export type VerifiedWebhookEvent = {
  eventId: string;
  eventType: string;
  internalReference: string | null;
  providerPaymentId: string | null;
  /**
   * Target payment status after verification.
   * Only server-verified webhook events may set PAID.
   */
  status: PaymentStatus;
  amount?: Prisma.Decimal | null;
  summary?: Record<string, unknown>;
};

export type ProviderWebhookInput = {
  rawBody: Buffer;
  headers: Record<string, string | string[] | undefined>;
  publicConfig: Record<string, unknown>;
  secrets: Record<string, unknown>;
  mode: 'test' | 'live';
};

/**
 * Provider-agnostic online payment adapter.
 * Offline COD/OTHER do not use this interface for initiation.
 */
export interface PaymentGatewayAdapter {
  readonly code: PaymentProvider;

  createPayment(
    input: ProviderCreatePaymentInput,
  ): Promise<ProviderCreatePaymentResult>;

  verifyWebhook(input: ProviderWebhookInput): Promise<VerifiedWebhookEvent>;
}
