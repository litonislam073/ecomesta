import { Injectable, NotFoundException } from '@nestjs/common';
import { PaymentProvider } from '@prisma/client';
import { PaymentGatewayAdapter } from './payment-gateway.adapter';
import { SslCommerzPaymentProvider } from './sslcommerz/sslcommerz-payment.provider';
import { StripePaymentProvider } from './stripe/stripe-payment.provider';
import { TestPaymentProvider } from './test/test-payment.provider';

/** Providers that support online initiation via adapters. */
export const ONLINE_PAYMENT_PROVIDERS: PaymentProvider[] = [
  PaymentProvider.TEST,
  PaymentProvider.STRIPE,
  PaymentProvider.SSL_COMMERZ,
];

/** Offline checkout providers (no gateway redirect). */
export const OFFLINE_PAYMENT_PROVIDERS: PaymentProvider[] = [
  PaymentProvider.COD,
  PaymentProvider.OTHER,
];

@Injectable()
export class PaymentProviderRegistry {
  private readonly adapters: Map<PaymentProvider, PaymentGatewayAdapter>;

  constructor(
    testProvider: TestPaymentProvider,
    stripeProvider: StripePaymentProvider,
    sslCommerzProvider: SslCommerzPaymentProvider,
  ) {
    this.adapters = new Map<PaymentProvider, PaymentGatewayAdapter>([
      [PaymentProvider.TEST, testProvider],
      [PaymentProvider.STRIPE, stripeProvider],
      [PaymentProvider.SSL_COMMERZ, sslCommerzProvider],
    ]);
  }

  getAdapter(provider: PaymentProvider): PaymentGatewayAdapter {
    const adapter = this.adapters.get(provider);
    if (!adapter) {
      throw new NotFoundException(
        `Payment provider ${provider} is not implemented`,
      );
    }
    return adapter;
  }

  isOnline(provider: PaymentProvider): boolean {
    return ONLINE_PAYMENT_PROVIDERS.includes(provider);
  }

  isOffline(provider: PaymentProvider): boolean {
    return OFFLINE_PAYMENT_PROVIDERS.includes(provider);
  }

  listImplementedOnline(): PaymentProvider[] {
    return [...this.adapters.keys()];
  }
}
