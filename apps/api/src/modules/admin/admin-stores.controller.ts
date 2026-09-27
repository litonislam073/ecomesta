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
import { AdminStoresService } from './admin-stores.service';
import {
  ListAdminStoresQueryDto,
  UpdateStoreStatusDto,
} from './dto/admin-store.dto';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('SUPER_ADMIN')
@Controller({ path: 'admin/stores', version: '1' })
export class AdminStoresController {
  constructor(private readonly stores: AdminStoresService) {}

  @Get()
  @ApiOperation({ summary: 'List stores across all tenants' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListAdminStoresQueryDto,
  ) {
    return this.stores.list(user.userId, query);
  }

  @Get(':storeId')
  @ApiOperation({ summary: 'Get store detail with tenant, members and counts' })
  getOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
  ) {
    return this.stores.getOne(user.userId, storeId);
  }

  @Patch(':storeId/status')
  @ApiOperation({ summary: 'Suspend or reactivate a store' })
  updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Body() dto: UpdateStoreStatusDto,
    @Req() req: Request,
  ) {
    return this.stores.updateStatus(user.userId, storeId, dto, req);
  }
}
