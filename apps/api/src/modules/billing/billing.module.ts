import { Global, Module } from '@nestjs/common';
import { BillingAccessService } from './billing-access.service';
import { BillingController, PublicPlansController } from './billing.controller';
import { BillingService } from './billing.service';
import { SubscriptionLifecycleScheduler } from './subscription-lifecycle.scheduler';
import { SubscriptionLifecycleService } from './subscription-lifecycle.service';

/** Global so store-facing modules can enforce billing state without import cycles. */
@Global()
@Module({
  controllers: [BillingController, PublicPlansController],
  providers: [
    BillingService,
    BillingAccessService,
    SubscriptionLifecycleService,
    SubscriptionLifecycleScheduler,
  ],
  exports: [BillingService, BillingAccessService, SubscriptionLifecycleService],
})
export class BillingModule {}
