import { Module } from '@nestjs/common';
import { TenantsModule } from '../tenants/tenants.module';

/**
 * Membership read APIs live under TenantsController for Phase 4.
 * This module exists as the extension point for invitations/role changes later.
 */
@Module({
  imports: [TenantsModule],
  exports: [TenantsModule],
})
export class MembershipModule {}
