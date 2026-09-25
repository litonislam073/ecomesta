import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { StoreRole } from '@prisma/client';
import { AuthorizationService } from '../authorization.service';
import { STORE_ROLES_KEY } from '../decorators/require-store-role.decorator';
import type { AuthenticatedUser } from '../../auth/types/auth.types';

@Injectable()
export class StoreRoleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authorization: AuthorizationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const meta = this.reflector.getAllAndOverride<{
      roles: StoreRole[];
      storeIdParam: string;
    }>(STORE_ROLES_KEY, [context.getHandler(), context.getClass()]);

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

    const storeId = request.params[meta.storeIdParam];
    if (!storeId) {
      throw new UnauthorizedException('Store id is required');
    }
    await this.authorization.assertStoreRole(
      request.user.userId,
      storeId,
      meta.roles,
    );
    return true;
  }
}
