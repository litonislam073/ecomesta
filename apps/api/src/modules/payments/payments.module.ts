import { Module } from '@nestjs/common';
import { PaymentSecretsCryptoService } from './crypto/payment-secrets-crypto.service';
import { PaymentOrchestrationService } from './payment-orchestration.service';
import { PaymentProviderConfigService } from './payment-provider-config.service';
import { PaymentProvidersController } from './payment-providers.controller';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PublicPaymentsController } from './public-payments.controller';
import { PaymentProviderRegistry } from './providers/payment-provider.registry';
import { SslCommerzHttp } from './providers/sslcommerz/sslcommerz.http';
import { SslCommerzPaymentProvider } from './providers/sslcommerz/sslcommerz-payment.provider';
import { StripePaymentProvider } from './providers/stripe/stripe-payment.provider';
import { TestPaymentProvider } from './providers/test/test-payment.provider';

@Module({
  controllers: [
    PaymentsController,
    PaymentProvidersController,
    PublicPaymentsController,
  ],
  providers: [
    PaymentsService,
    PaymentSecretsCryptoService,
    TestPaymentProvider,
    StripePaymentProvider,
    SslCommerzHttp,
    SslCommerzPaymentProvider,
    PaymentProviderRegistry,
    PaymentProviderConfigService,
    PaymentOrchestrationService,
  ],
  exports: [
    PaymentsService,
    PaymentOrchestrationService,
    PaymentProviderConfigService,
    PaymentProviderRegistry,
    StripePaymentProvider,
    SslCommerzPaymentProvider,
  ],
})
export class PaymentsModule {}
