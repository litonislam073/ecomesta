import { SetMetadata } from '@nestjs/common';
import type { AppRole } from '../types/auth.types';

export const ROLES_KEY = 'roles';

export const Roles = (...roles: AppRole[]) => SetMetadata(ROLES_KEY, roles);
