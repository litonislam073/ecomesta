import { Module } from '@nestjs/common';
import { AiSupportModule } from '../ai-support/ai-support.module';
import { AuthModule } from '../auth/auth.module';
import { AdminAuditController } from './admin-audit.controller';
import { AdminBillingPaymentsController } from './admin-billing-payments.controller';
import { AdminAuditService } from './admin-audit.service';
import { AdminEmailController } from './admin-email.controller';
import { AdminPlansController } from './admin-plans.controller';
import { AdminPlansService } from './admin-plans.service';
import { AdminStatsService } from './admin-stats.service';
import { AdminStoresController } from './admin-stores.controller';
import { AdminSupportChatsController } from './admin-support-chats.controller';
import { AdminStoresService } from './admin-stores.service';
import { AdminSubscriptionsController } from './admin-subscriptions.controller';
import { AdminSubscriptionsService } from './admin-subscriptions.service';
import { AdminTenantsController } from './admin-tenants.controller';
import { AdminTenantsService } from './admin-tenants.service';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';
import { AdminController } from './admin.controller';

@Module({
  imports: [AuthModule, AiSupportModule],
  controllers: [
    AdminController,
    AdminBillingPaymentsController,
    AdminUsersController,
    AdminTenantsController,
    AdminStoresController,
    AdminPlansController,
    AdminSubscriptionsController,
    AdminAuditController,
    AdminEmailController,
    AdminSupportChatsController,
  ],
  providers: [
    AdminStatsService,
    AdminUsersService,
    AdminTenantsService,
    AdminStoresService,
    AdminPlansService,
    AdminSubscriptionsService,
    AdminAuditService,
  ],
})
export class AdminModule {}
