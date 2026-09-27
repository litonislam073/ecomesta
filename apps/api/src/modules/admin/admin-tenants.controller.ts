import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import { AdminTenantsService } from './admin-tenants.service';
import {
  ListAdminTenantsQueryDto,
  UpdateTenantStatusDto,
} from './dto/admin-tenant.dto';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('SUPER_ADMIN')
@Controller({ path: 'admin/tenants', version: '1' })
export class AdminTenantsController {
  constructor(private readonly tenants: AdminTenantsService) {}

  @Get()
  @ApiOperation({ summary: 'List tenants' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListAdminTenantsQueryDto,
  ) {
    return this.tenants.list(user.userId, query);
  }

  @Get(':tenantId')
  @ApiOperation({ summary: 'Get tenant detail with stores, members and usage' })
  getOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
  ) {
    return this.tenants.getOne(user.userId, tenantId);
  }

  @Patch(':tenantId/status')
  @ApiOperation({ summary: 'Suspend or reactivate a tenant' })
  updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Body() dto: UpdateTenantStatusDto,
    @Req() req: Request,
  ) {
    return this.tenants.updateStatus(user.userId, tenantId, dto, req);
  }
}
