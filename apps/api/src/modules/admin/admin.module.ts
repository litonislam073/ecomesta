import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminAuditController } from './admin-audit.controller';
import { AdminAuditService } from './admin-audit.service';
import { AdminEmailController } from './admin-email.controller';
import { AdminPlansController } from './admin-plans.controller';
import { AdminPlansService } from './admin-plans.service';
import { AdminStatsService } from './admin-stats.service';
import { AdminStoresController } from './admin-stores.controller';
import { AdminStoresService } from './admin-stores.service';
import { AdminSubscriptionsController } from './admin-subscriptions.controller';
import { AdminSubscriptionsService } from './admin-subscriptions.service';
import { AdminTenantsController } from './admin-tenants.controller';
import { AdminTenantsService } from './admin-tenants.service';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';
import { AdminController } from './admin.controller';

@Module({
  imports: [AuthModule],
  controllers: [
    AdminController,
    AdminUsersController,
    AdminTenantsController,
    AdminStoresController,
    AdminPlansController,
    AdminSubscriptionsController,
    AdminAuditController,
    AdminEmailController,
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
