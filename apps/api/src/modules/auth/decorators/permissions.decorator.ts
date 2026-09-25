import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';

/**
 * Placeholder for fine-grained permissions in later phases.
 * Roles remain the primary authorization mechanism in Phase 3.
 */
export const Permissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
