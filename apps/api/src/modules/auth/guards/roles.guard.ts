import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from '../auth.service';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { AppRole, AuthenticatedUser } from '../types/auth.types';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<AppRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }

    if (user.platformRole === 'SUPER_ADMIN') {
      return true;
    }

    const platformRoles = requiredRoles.filter((role) => role === 'SUPER_ADMIN');
    if (platformRoles.includes('SUPER_ADMIN') && user.platformRole === 'SUPER_ADMIN') {
      return true;
    }

    const tenantRoles = requiredRoles.filter((role) =>
      ['OWNER', 'ADMIN', 'STAFF'].includes(role),
    ) as Array<'OWNER' | 'ADMIN' | 'STAFF'>;
    const storeRoles = requiredRoles.filter((role) =>
      ['STORE_MANAGER', 'STORE_STAFF'].includes(role),
    ) as Array<'STORE_MANAGER' | 'STORE_STAFF'>;

    if (tenantRoles.length === 0 && storeRoles.length === 0 && platformRoles.length > 0) {
      throw new ForbiddenException('Insufficient platform role');
    }

    const memberships = await this.authService.loadMemberships(user.userId);

    const hasTenantRole =
      tenantRoles.length === 0 ||
      memberships.tenants.some((membership) =>
        tenantRoles.includes(membership.role as 'OWNER' | 'ADMIN' | 'STAFF'),
      );

    const hasStoreRole =
      storeRoles.length === 0 ||
      memberships.stores.some((membership) =>
        storeRoles.includes(membership.role as 'STORE_MANAGER' | 'STORE_STAFF'),
      );

    if (
      (tenantRoles.length > 0 && hasTenantRole) ||
      (storeRoles.length > 0 && hasStoreRole)
    ) {
      return true;
    }

    throw new ForbiddenException('Insufficient role');
  }
}
