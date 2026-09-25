import { SetMetadata } from '@nestjs/common';
import { StoreRole } from '@prisma/client';

export const STORE_ROLES_KEY = 'store_roles';

export const RequireStoreRole = (
  roles: StoreRole[],
  options?: { storeIdParam?: string },
) => SetMetadata(STORE_ROLES_KEY, { roles, storeIdParam: options?.storeIdParam ?? 'storeId' });
