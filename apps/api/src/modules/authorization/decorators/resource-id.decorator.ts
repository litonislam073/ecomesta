import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const TenantIdParam = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<{ params: { tenantId?: string } }>();
    return request.params.tenantId ?? '';
  },
);

export const StoreIdParam = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<{ params: { storeId?: string } }>();
    return request.params.storeId ?? '';
  },
);
