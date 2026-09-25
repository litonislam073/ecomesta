import { Global, Module } from '@nestjs/common';
import { AuthorizationService } from './authorization.service';
import { StoreRoleGuard } from './guards/store-role.guard';
import { TenantRoleGuard } from './guards/tenant-role.guard';

@Global()
@Module({
  providers: [AuthorizationService, TenantRoleGuard, StoreRoleGuard],
  exports: [AuthorizationService, TenantRoleGuard, StoreRoleGuard],
})
export class AuthorizationModule {}
