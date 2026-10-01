import { Global, Module } from '@nestjs/common';
import { BillingAccessService } from './billing-access.service';
import { BillingController, PublicPlansController } from './billing.controller';
import { BillingPaymentsService } from './billing-payments.service';
import { BillingService } from './billing.service';
import { PlanEntitlementsService } from './plan-entitlements.service';
import { SubscriptionLifecycleScheduler } from './subscription-lifecycle.scheduler';
import { SubscriptionLifecycleService } from './subscription-lifecycle.service';

/** Global so store-facing modules can enforce billing state without import cycles. */
@Global()
@Module({
  controllers: [BillingController, PublicPlansController],
  providers: [
    BillingService,
    BillingAccessService,
    BillingPaymentsService,
    PlanEntitlementsService,
    SubscriptionLifecycleService,
    SubscriptionLifecycleScheduler,
  ],
  exports: [
    BillingService,
    BillingAccessService,
    BillingPaymentsService,
    PlanEntitlementsService,
    SubscriptionLifecycleService,
  ],
})
export class BillingModule {}
