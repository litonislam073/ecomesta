import { SetMetadata } from '@nestjs/common';
import { TenantRole } from '@prisma/client';

export const TENANT_ROLES_KEY = 'tenant_roles';
export const TENANT_ID_PARAM_KEY = 'tenant_id_param';

export const RequireTenantRole = (
  roles: TenantRole[],
  options?: { tenantIdParam?: string },
) => SetMetadata(TENANT_ROLES_KEY, { roles, tenantIdParam: options?.tenantIdParam ?? 'tenantId' });
