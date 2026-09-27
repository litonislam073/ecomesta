import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import type { Request } from 'express';
import { LoggerModule } from 'nestjs-pino';
import {
  isInternalServiceRequest,
  trustProxyEnabled,
} from './common/utils/request-host.util';
import { validateEnv } from './config/env.validation';
import { HealthModule } from './health/health.module';
import { AdminModule } from './modules/admin/admin.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { AuthorizationModule } from './modules/authorization/authorization.module';
import { BillingModule } from './modules/billing/billing.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { CustomersModule } from './modules/customers/customers.module';
import { DemoCatalogModule } from './modules/demo-catalog/demo-catalog.module';
import { DomainsModule } from './modules/domains/domains.module';
import { EmailModule } from './modules/email/email.module';
import { CouponsModule } from './modules/coupons/coupons.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { MembershipModule } from './modules/membership/membership.module';
import { OnboardingModule } from './modules/onboarding/onboarding.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { ProductsModule } from './modules/products/products.module';
import { PublicStorefrontModule } from './modules/public-storefront/public-storefront.module';
import { ShipmentsModule } from './modules/shipments/shipments.module';
import { ShippingModule } from './modules/shipping/shipping.module';
import { StoresModule } from './modules/stores/stores.module';
import { SupportModule } from './modules/support/support.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { ThemesModule } from './modules/themes/themes.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['.env', '../../.env'],
      validate: validateEnv,
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        transport:
          process.env.NODE_ENV !== 'production'
            ? {
                target: 'pino-pretty',
                options: {
                  singleLine: true,
                  colorize: true,
                },
              }
            : undefined,
        autoLogging: true,
        redact: [
          'req.headers.authorization',
          'req.headers.cookie',
          'req.body.password',
          'req.body.refreshToken',
          'req.body.token',
          'res.headers["set-cookie"]',
        ],
      },
    }),
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 60_000,
          limit: 120,
        },
      ],
      // Storefront SSR shares one source IP for every shopper; per-shopper
      // limits for page views are applied at nginx instead.
      skipIf: (context) =>
        isInternalServiceRequest(
          context.switchToHttp().getRequest<Request>(),
          trustProxyEnabled(),
        ),
    }),
    PrismaModule,
    RedisModule,
    AuditModule,
    EmailModule,
    AuthorizationModule,
    BillingModule,
    HealthModule,
    AuthModule,
    TenantsModule,
    StoresModule,
    MembershipModule,
    OnboardingModule,
    CategoriesModule,
    ProductsModule,
    InventoryModule,
    DemoCatalogModule,
    CustomersModule,
    CouponsModule,
    OrdersModule,
    ShippingModule,
    PaymentsModule,
    ShipmentsModule,
    PublicStorefrontModule,
    ThemesModule,
    DomainsModule,
    AdminModule,
    SupportModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
