import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  PaymentProvider,
  PaymentStatus,
  Prisma,
} from '@prisma/client';
import { randomBytes } from 'node:crypto';
import {
  PaymentGatewayAdapter,
  ProviderCreatePaymentInput,
  ProviderCreatePaymentResult,
  ProviderWebhookInput,
  VerifiedWebhookEvent,
} from '../payment-gateway.adapter';
import { SslCommerzHttp } from './sslcommerz.http';

const SESSION_URL = {
  test: 'https://sandbox-gw.sslcommerz.com/gwprocess/v4/api.php',
  live: 'https://securepay.sslcommerz.com/gwprocess/v4/api.php',
} as const;

const VALIDATE_URL = {
  test: 'https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php',
  live: 'https://securepay.sslcommerz.com/validator/api/validationserverAPI.php',
} as const;

const BDT_MIN = new Prisma.Decimal('10.00');

/**
 * SSLCommerz v4 hosted checkout (Bangladesh).
 * Authoritative confirmation = Order Validation API after IPN — never browser success URL.
 * Secrets (store_passwd) are never logged or returned.
 */
@Injectable()
export class SslCommerzPaymentProvider implements PaymentGatewayAdapter {
  readonly code = PaymentProvider.SSL_COMMERZ;

  constructor(private readonly http: SslCommerzHttp) {}

  async createPayment(
    input: ProviderCreatePaymentInput,
  ): Promise<ProviderCreatePaymentResult> {
    const { storeId, storePassword } = this.requireSecrets(input.secrets);
    const currency = input.currency.trim().toUpperCase();
    if (currency === 'BDT' && input.amount.lt(BDT_MIN)) {
      throw new BadRequestException(
        'SSLCommerz requires a minimum amount of 10.00 BDT',
      );
    }

    const apiBase =
      typeof input.publicConfig.apiBaseUrl === 'string'
        ? input.publicConfig.apiBaseUrl.replace(/\/$/, '')
        : '';
    if (!apiBase) {
      throw new BadRequestException(
        'SSLCommerz requires publicConfig.apiBaseUrl for IPN URL construction',
      );
    }

    const totalAmount = input.amount.toFixed(2);
    const customer = input.customer ?? {};
    const cusName = (customer.name?.trim() || 'Customer').slice(0, 50);
    const cusEmail = (customer.email?.trim() || 'noreply@ecomesta.local').slice(
      0,
      50,
    );
    const cusPhone = (customer.phone?.trim() || '00000000000').slice(0, 20);
    const cusAdd1 = (customer.addressLine1?.trim() || 'N/A').slice(0, 50);
    const cusCity = (customer.city?.trim() || 'N/A').slice(0, 50);
    const cusPostcode = (customer.postalCode?.trim() || '0000').slice(0, 30);
    const cusCountry = (customer.country?.trim() || 'BD').slice(0, 50);

    const fields: Record<string, string> = {
      store_id: storeId,
      store_passwd: storePassword,
      total_amount: totalAmount,
      currency,
      tran_id: input.internalReference.slice(0, 30),
      product_category: 'ecommerce',
      success_url: input.returnUrls.success,
      fail_url: input.returnUrls.failure,
      cancel_url: input.returnUrls.cancel,
      ipn_url: `${apiBase}/api/v1/public/payment-webhooks/SSL_COMMERZ`,
      cus_name: cusName,
      cus_email: cusEmail,
      cus_add1: cusAdd1,
      cus_city: cusCity,
      cus_postcode: cusPostcode,
      cus_country: cusCountry,
      cus_phone: cusPhone,
      shipping_method: 'NO',
      num_of_item: '1',
      product_name: `Order payment (${input.internalReference})`.slice(0, 255),
      product_profile: 'general',
      value_a: input.paymentId,
      value_b: storeId,
    };

    const response = await this.http.postForm(SESSION_URL[input.mode], fields);
    const body = asRecord(response.body);
    const status = typeof body?.status === 'string' ? body.status : null;
    const gatewayUrl =
      typeof body?.GatewayPageURL === 'string' ? body.GatewayPageURL : null;
    const sessionkey =
      typeof body?.sessionkey === 'string' ? body.sessionkey : null;

    if (status !== 'SUCCESS' || !gatewayUrl || !sessionkey) {
      const reason =
        typeof body?.failedreason === 'string' && body.failedreason
          ? body.failedreason
          : 'SSLCommerz session initiation failed';
      throw new BadRequestException(reason);
    }

    return {
      providerPaymentId: sessionkey,
      redirectUrl: gatewayUrl,
      clientPayload: {
        provider: PaymentProvider.SSL_COMMERZ,
        sessionkey,
        internalReference: input.internalReference,
      },
    };
  }

  async verifyWebhook(input: ProviderWebhookInput): Promise<VerifiedWebhookEvent> {
    const { storeId, storePassword } = this.requireSecrets(input.secrets);
    const payload = this.parseBody(input.rawBody);

    const ipnStatus =
      typeof payload.status === 'string' ? payload.status.toUpperCase() : '';
    const tranId =
      typeof payload.tran_id === 'string' && payload.tran_id
        ? payload.tran_id
        : null;
    const valId =
      typeof payload.val_id === 'string' && payload.val_id
        ? payload.val_id
        : null;
    const bankTranId =
      typeof payload.bank_tran_id === 'string' ? payload.bank_tran_id : '';

    if (!tranId) {
      throw new BadRequestException('SSLCommerz IPN missing tran_id');
    }

    /**
     * Fail/cancel/expiry IPN trust policy:
     * - Never mark FAILED/CANCELLED from an unsigned raw IPN body alone.
     * - If `val_id` is present, re-check via the Order Validation API.
     * - Without `val_id`, reject (no status update) — forged fail/cancel
     *   notifications must not mutate payment state.
     * - Explicit `INVALID_TRANSACTION` from validation → FAILED.
     */
    const isFailLike =
      ipnStatus === 'FAILED' ||
      ipnStatus === 'UNATTEMPTED' ||
      ipnStatus === 'EXPIRED';
    const isCancelLike = ipnStatus === 'CANCELLED' || ipnStatus === 'CANCEL';

    if (isFailLike || isCancelLike) {
      if (!valId) {
        throw new UnauthorizedException(
          'SSLCommerz fail/cancel IPN rejected without val_id; Order Validation required',
        );
      }

      const validation = await this.http.getJson(VALIDATE_URL[input.mode], {
        val_id: valId,
        store_id: storeId,
        store_passwd: storePassword,
        format: 'json',
      });
      const validated = asRecord(validation.body);
      const validatedStatus =
        typeof validated?.status === 'string'
          ? validated.status.toUpperCase()
          : '';

      if (validatedStatus === 'INVALID_TRANSACTION') {
        return {
          eventId: this.eventId(valId, tranId, 'INVALID', bankTranId),
          eventType: 'sslcommerz.invalid_transaction',
          internalReference: tranId,
          providerPaymentId: this.sessionKeyFromPayload(validated ?? payload),
          status: PaymentStatus.FAILED,
          amount: this.amountFromPayload(validated ?? payload),
          summary: {
            eventType: 'sslcommerz.invalid_transaction',
            status: PaymentStatus.FAILED,
            validationStatus: validatedStatus,
          },
        };
      }

      // Validation did not confirm INVALID_TRANSACTION. Do not trust the
      // unsigned fail/cancel claim for a still-valid session.
      if (validatedStatus === 'VALID' || validatedStatus === 'VALIDATED') {
        throw new BadRequestException(
          'SSLCommerz fail/cancel IPN contradicted by Order Validation (transaction still valid)',
        );
      }

      const terminalStatus = isCancelLike
        ? PaymentStatus.CANCELLED
        : PaymentStatus.FAILED;
      return {
        eventId: this.eventId(valId, tranId, ipnStatus, bankTranId),
        eventType: `sslcommerz.${(isCancelLike ? 'cancelled' : ipnStatus).toLowerCase()}`,
        internalReference: tranId,
        providerPaymentId: this.sessionKeyFromPayload(validated ?? payload),
        status: terminalStatus,
        amount: this.amountFromPayload(validated ?? payload),
        summary: {
          eventType: `sslcommerz.${terminalStatus.toLowerCase()}`,
          status: terminalStatus,
          validationStatus: validatedStatus,
        },
      };
    }

    // Success-like IPN: must re-validate via Order Validation API when val_id present.
    if (!valId) {
      throw new BadRequestException(
        'SSLCommerz success IPN missing val_id; Order Validation API required',
      );
    }

    const validation = await this.http.getJson(VALIDATE_URL[input.mode], {
      val_id: valId,
      store_id: storeId,
      store_passwd: storePassword,
      format: 'json',
    });
    const validated = asRecord(validation.body);
    const validatedStatus =
      typeof validated?.status === 'string'
        ? validated.status.toUpperCase()
        : '';

    if (validatedStatus === 'INVALID_TRANSACTION') {
      throw new UnauthorizedException(
        'SSLCommerz Order Validation rejected transaction',
      );
    }

    if (validatedStatus !== 'VALID' && validatedStatus !== 'VALIDATED') {
      throw new BadRequestException(
        `SSLCommerz Order Validation returned unexpected status: ${validatedStatus || 'unknown'}`,
      );
    }

    const amount = this.amountFromPayload(validated ?? payload);
    return {
      eventId: valId,
      eventType: 'sslcommerz.validated',
      internalReference:
        typeof validated?.tran_id === 'string' && validated.tran_id
          ? validated.tran_id
          : tranId,
      providerPaymentId: this.sessionKeyFromPayload(validated ?? payload),
      status: PaymentStatus.PAID,
      amount,
      summary: {
        eventType: 'sslcommerz.validated',
        status: PaymentStatus.PAID,
        validationStatus: validatedStatus,
      },
    };
  }

  /**
   * Connectivity check: initiate a 10.00 session with a unique throwaway tran_id.
   * Does not complete payment. Invalid store credentials → 422.
   */
  async validateConfig(
    secrets: Record<string, unknown>,
    mode: 'test' | 'live',
  ): Promise<{ ok: true }> {
    const { storeId, storePassword } = this.requireSecrets(secrets);
    const tranId = `cfg_${randomBytes(10).toString('base64url')}`.slice(0, 30);
    const fields: Record<string, string> = {
      store_id: storeId,
      store_passwd: storePassword,
      total_amount: '10.00',
      currency: 'BDT',
      tran_id: tranId,
      product_category: 'ecommerce',
      success_url: 'https://example.invalid/sslcommerz/success',
      fail_url: 'https://example.invalid/sslcommerz/fail',
      cancel_url: 'https://example.invalid/sslcommerz/cancel',
      cus_name: 'Config Check',
      cus_email: 'noreply@ecomesta.local',
      cus_add1: 'N/A',
      cus_city: 'Dhaka',
      cus_postcode: '1000',
      cus_country: 'BD',
      cus_phone: '01700000000',
      shipping_method: 'NO',
      num_of_item: '1',
      product_name: 'Config validation',
      product_profile: 'general',
    };

    const response = await this.http.postForm(SESSION_URL[mode], fields);
    const body = asRecord(response.body);
    const status = typeof body?.status === 'string' ? body.status : null;
    const gatewayUrl =
      typeof body?.GatewayPageURL === 'string' ? body.GatewayPageURL : null;

    if (status === 'SUCCESS' && gatewayUrl) {
      return { ok: true };
    }

    const reason =
      typeof body?.failedreason === 'string' && body.failedreason
        ? body.failedreason
        : 'SSLCommerz configuration validation failed';
    throw new UnprocessableEntityException(reason);
  }

  private requireSecrets(secrets: Record<string, unknown>): {
    storeId: string;
    storePassword: string;
  } {
    const storeId = secrets.storeId;
    const storePassword = secrets.storePassword;
    if (typeof storeId !== 'string' || !storeId) {
      throw new BadRequestException(
        'SSL_COMMERZ provider secrets.storeId is required',
      );
    }
    if (typeof storePassword !== 'string' || !storePassword) {
      throw new BadRequestException(
        'SSL_COMMERZ provider secrets.storePassword is required',
      );
    }
    return { storeId, storePassword };
  }

  private parseBody(rawBody: Buffer): Record<string, unknown> {
    const text = rawBody.toString('utf8').trim();
    if (!text) {
      throw new BadRequestException('Empty SSLCommerz webhook body');
    }
    try {
      const json = JSON.parse(text) as unknown;
      if (json && typeof json === 'object' && !Array.isArray(json)) {
        return json as Record<string, unknown>;
      }
    } catch {
      // form-urlencoded IPN
    }
    const params = new URLSearchParams(text);
    const out: Record<string, unknown> = {};
    for (const [key, value] of params.entries()) {
      out[key] = value;
    }
    if (Object.keys(out).length === 0) {
      throw new BadRequestException('Malformed SSLCommerz webhook body');
    }
    return out;
  }

  private eventId(
    valId: string | null,
    tranId: string,
    status: string,
    bankTranId: string,
  ): string {
    if (valId) return valId;
    return `${tranId}:${status}:${bankTranId || 'none'}`;
  }

  private sessionKeyFromPayload(
    payload: Record<string, unknown> | null,
  ): string | null {
    if (!payload) return null;
    const key = payload.sessionkey;
    return typeof key === 'string' && key ? key : null;
  }

  private amountFromPayload(
    payload: Record<string, unknown> | null,
  ): Prisma.Decimal | null {
    if (!payload) return null;
    const currencyAmount = payload.currency_amount;
    if (currencyAmount !== undefined && currencyAmount !== null && currencyAmount !== '') {
      return new Prisma.Decimal(String(currencyAmount));
    }
    const amount = payload.amount;
    if (amount !== undefined && amount !== null && amount !== '') {
      return new Prisma.Decimal(String(amount));
    }
    return null;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}
