import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TenantRole } from '@prisma/client';
import { AuthorizationService } from '../authorization.service';
import { TENANT_ROLES_KEY } from '../decorators/require-tenant-role.decorator';
import type { AuthenticatedUser } from '../../auth/types/auth.types';

@Injectable()
export class TenantRoleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authorization: AuthorizationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const meta = this.reflector.getAllAndOverride<{
      roles: TenantRole[];
      tenantIdParam: string;
    }>(TENANT_ROLES_KEY, [context.getHandler(), context.getClass()]);

    if (!meta) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      user?: AuthenticatedUser;
      params: Record<string, string>;
    }>();

    if (!request.user) {
      throw new UnauthorizedException('Authentication required');
    }

    const tenantId = request.params[meta.tenantIdParam];
    if (!tenantId) {
      throw new UnauthorizedException('Tenant id is required');
    }
    await this.authorization.assertTenantRole(
      request.user.userId,
      tenantId,
      meta.roles,
    );
    return true;
  }
}
