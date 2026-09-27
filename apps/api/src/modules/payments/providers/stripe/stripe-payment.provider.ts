import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import {
  PaymentProvider,
  PaymentStatus,
  Prisma,
} from '@prisma/client';
import Stripe from 'stripe';
import {
  PaymentGatewayAdapter,
  ProviderCreatePaymentInput,
  ProviderCreatePaymentResult,
  ProviderWebhookInput,
  VerifiedWebhookEvent,
} from '../payment-gateway.adapter';

/**
 * Stripe Checkout (hosted) adapter.
 * Payment is marked PAID only via verified webhooks — never from return URLs.
 * Secrets and card data are never logged or returned.
 */
@Injectable()
export class StripePaymentProvider implements PaymentGatewayAdapter {
  readonly code = PaymentProvider.STRIPE;

  async createPayment(
    input: ProviderCreatePaymentInput,
  ): Promise<ProviderCreatePaymentResult> {
    const secretKey = this.requireSecretKey(input.secrets);
    const stripe = this.createClient(secretKey);
    const unitAmount = this.amountToCents(input.amount);
    const currency = input.currency.trim().toLowerCase();

    const metadata: Stripe.MetadataParam = {
      ecomestaInternalReference: input.internalReference,
      orderId: input.orderId,
      storeId: input.storeId,
      paymentId: input.paymentId,
    };

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      client_reference_id: input.internalReference,
      success_url: input.returnUrls.success,
      cancel_url: input.returnUrls.cancel,
      customer_email: input.customer?.email?.trim() || undefined,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency,
            unit_amount: unitAmount,
            product_data: {
              name: `Order payment (${input.internalReference})`,
            },
          },
        },
      ],
      metadata,
      payment_intent_data: {
        metadata,
      },
    });

    if (!session.url) {
      throw new BadRequestException('Stripe Checkout Session missing redirect URL');
    }

    return {
      providerPaymentId: session.id,
      redirectUrl: session.url,
      clientPayload: {
        provider: PaymentProvider.STRIPE,
        sessionId: session.id,
        internalReference: input.internalReference,
      },
    };
  }

  async verifyWebhook(input: ProviderWebhookInput): Promise<VerifiedWebhookEvent> {
    const secretKey = this.requireSecretKey(input.secrets);
    const webhookSecret = input.secrets.webhookSecret;
    if (typeof webhookSecret !== 'string' || !webhookSecret) {
      throw new UnauthorizedException(
        'STRIPE provider webhook secret is not configured',
      );
    }

    const signatureHeader = input.headers['stripe-signature'];
    const signature = Array.isArray(signatureHeader)
      ? signatureHeader[0]
      : signatureHeader;
    if (!signature) {
      throw new UnauthorizedException('Missing Stripe webhook signature');
    }

    const stripe = this.createClient(secretKey);
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        input.rawBody,
        signature,
        webhookSecret,
      );
    } catch {
      throw new UnauthorizedException('Invalid Stripe webhook signature');
    }

    return this.mapEvent(event);
  }

  /** Optional connectivity check — does not charge. */
  async validateConfig(secrets: Record<string, unknown>): Promise<{ ok: true }> {
    const secretKey = this.requireSecretKey(secrets);
    const stripe = this.createClient(secretKey);
    await stripe.balance.retrieve();
    return { ok: true };
  }

  private mapEvent(event: Stripe.Event): VerifiedWebhookEvent {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const paid = session.payment_status === 'paid';
        return {
          eventId: event.id,
          eventType: event.type,
          internalReference: this.sessionInternalReference(session),
          providerPaymentId: session.id,
          status: paid ? PaymentStatus.PAID : PaymentStatus.PENDING,
          amount: this.sessionAmount(session),
          summary: {
            eventType: event.type,
            paymentStatus: session.payment_status,
            status: paid ? PaymentStatus.PAID : PaymentStatus.PENDING,
          },
        };
      }
      case 'payment_intent.succeeded': {
        const intent = event.data.object as Stripe.PaymentIntent;
        return {
          eventId: event.id,
          eventType: event.type,
          internalReference: this.intentInternalReference(intent),
          providerPaymentId: intent.id,
          status: PaymentStatus.PAID,
          amount: this.intentAmount(intent),
          summary: {
            eventType: event.type,
            status: PaymentStatus.PAID,
          },
        };
      }
      case 'payment_intent.payment_failed': {
        const intent = event.data.object as Stripe.PaymentIntent;
        return {
          eventId: event.id,
          eventType: event.type,
          internalReference: this.intentInternalReference(intent),
          providerPaymentId: intent.id,
          status: PaymentStatus.FAILED,
          amount: this.intentAmount(intent),
          summary: {
            eventType: event.type,
            status: PaymentStatus.FAILED,
          },
        };
      }
      default:
        throw new BadRequestException(
          `Unsupported Stripe webhook event type: ${event.type}`,
        );
    }
  }

  private sessionInternalReference(
    session: Stripe.Checkout.Session,
  ): string | null {
    if (
      typeof session.client_reference_id === 'string' &&
      session.client_reference_id
    ) {
      return session.client_reference_id;
    }
    const meta = session.metadata?.ecomestaInternalReference;
    return typeof meta === 'string' && meta ? meta : null;
  }

  private intentInternalReference(
    intent: Stripe.PaymentIntent,
  ): string | null {
    const meta = intent.metadata?.ecomestaInternalReference;
    return typeof meta === 'string' && meta ? meta : null;
  }

  private sessionAmount(
    session: Stripe.Checkout.Session,
  ): Prisma.Decimal | null {
    if (session.amount_total == null) return null;
    return new Prisma.Decimal(session.amount_total).div(100);
  }

  private intentAmount(intent: Stripe.PaymentIntent): Prisma.Decimal | null {
    if (intent.amount_received == null && intent.amount == null) return null;
    const cents = intent.amount_received ?? intent.amount;
    return new Prisma.Decimal(cents).div(100);
  }

  /**
   * Convert Decimal money to integer cents without floating-point drift.
   */
  private amountToCents(amount: Prisma.Decimal): number {
    const cents = amount.mul(100).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP);
    const n = Number(cents.toString());
    if (!Number.isSafeInteger(n) || n <= 0) {
      throw new BadRequestException('Invalid payment amount for Stripe');
    }
    return n;
  }

  private requireSecretKey(secrets: Record<string, unknown>): string {
    const secretKey = secrets.secretKey;
    if (typeof secretKey !== 'string' || !secretKey) {
      throw new BadRequestException(
        'STRIPE provider secrets.secretKey is required',
      );
    }
    return secretKey;
  }

  private createClient(secretKey: string): Stripe {
    return new Stripe(secretKey);
  }
}
