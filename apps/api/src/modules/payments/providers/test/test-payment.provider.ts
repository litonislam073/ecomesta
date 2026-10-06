import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  PaymentProvider,
  PaymentStatus,
  Prisma,
} from '@prisma/client';
import {
  PaymentGatewayAdapter,
  ProviderCreatePaymentInput,
  ProviderCreatePaymentResult,
  ProviderWebhookInput,
  VerifiedWebhookEvent,
} from '../payment-gateway.adapter';

/**
 * Deterministic TEST gateway for automated tests and local online flows.
 * Signature: HMAC-SHA256 hex of raw body using secrets.webhookSecret.
 * Header: x-ecomesta-test-signature
 */
@Injectable()
export class TestPaymentProvider implements PaymentGatewayAdapter {
  readonly code = PaymentProvider.TEST;

  async createPayment(
    input: ProviderCreatePaymentInput,
  ): Promise<ProviderCreatePaymentResult> {
    const providerPaymentId = `test_${input.internalReference}`;
    const base =
      typeof input.publicConfig.simulateBaseUrl === 'string'
        ? input.publicConfig.simulateBaseUrl.replace(/\/$/, '')
        : null;
    const redirectUrl = base
      ? `${base}/payment/continue?ref=${encodeURIComponent(input.internalReference)}`
      : /[?&]ref=/.test(input.returnUrls.success)
        ? input.returnUrls.success
        : input.returnUrls.success.includes('?')
          ? `${input.returnUrls.success}&ref=${encodeURIComponent(input.internalReference)}`
          : `${input.returnUrls.success}?ref=${encodeURIComponent(input.internalReference)}`;

    return {
      providerPaymentId,
      redirectUrl,
      clientPayload: {
        provider: PaymentProvider.TEST,
        internalReference: input.internalReference,
        amount: input.amount.toFixed(2),
        currency: input.currency,
      },
    };
  }

  async verifyWebhook(input: ProviderWebhookInput): Promise<VerifiedWebhookEvent> {
    const secret = input.secrets.webhookSecret;
    if (typeof secret !== 'string' || !secret) {
      throw new UnauthorizedException('TEST provider webhook secret is not configured');
    }

    const signatureHeader = input.headers['x-ecomesta-test-signature'];
    const signature = Array.isArray(signatureHeader)
      ? signatureHeader[0]
      : signatureHeader;
    if (!signature) {
      throw new UnauthorizedException('Missing webhook signature');
    }

    const expected = createHmac('sha256', secret)
      .update(input.rawBody)
      .digest('hex');
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(String(signature), 'utf8');
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(input.rawBody.toString('utf8')) as Record<string, unknown>;
    } catch {
      throw new BadRequestException('Malformed webhook JSON');
    }

    const eventId = typeof payload.eventId === 'string' ? payload.eventId : null;
    const eventType = typeof payload.eventType === 'string' ? payload.eventType : null;
    const internalReference =
      typeof payload.internalReference === 'string'
        ? payload.internalReference
        : null;
    const providerPaymentId =
      typeof payload.providerPaymentId === 'string'
        ? payload.providerPaymentId
        : null;
    const statusRaw = typeof payload.status === 'string' ? payload.status : null;

    if (!eventId || !eventType || !statusRaw) {
      throw new BadRequestException('Webhook missing required fields');
    }

    const status = this.mapStatus(statusRaw);
    let amount: Prisma.Decimal | null = null;
    if (payload.amount !== undefined && payload.amount !== null) {
      amount = new Prisma.Decimal(String(payload.amount));
    }

    return {
      eventId,
      eventType,
      internalReference,
      providerPaymentId,
      status,
      amount,
      summary: {
        eventType,
        status,
        internalReference,
      },
    };
  }

  private mapStatus(raw: string): PaymentStatus {
    switch (raw) {
      case 'PAID':
        return PaymentStatus.PAID;
      case 'FAILED':
        return PaymentStatus.FAILED;
      case 'CANCELLED':
        return PaymentStatus.CANCELLED;
      case 'AUTHORIZED':
        return PaymentStatus.AUTHORIZED;
      case 'PENDING':
        return PaymentStatus.PENDING;
      default:
        throw new BadRequestException(`Unsupported TEST webhook status: ${raw}`);
    }
  }
}
