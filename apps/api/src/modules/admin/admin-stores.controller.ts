import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
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
import { AdminStoreDeletionService } from './admin-store-deletion.service';
import { AdminStoresService } from './admin-stores.service';
import {
  ListAdminStoresQueryDto,
  PermanentDeleteStoreDto,
  RestoreStoreDto,
  SoftDeleteStoreDto,
  UpdateStoreStatusDto,
} from './dto/admin-store.dto';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('SUPER_ADMIN')
@Controller({ path: 'admin/stores', version: '1' })
export class AdminStoresController {
  constructor(
    private readonly stores: AdminStoresService,
    private readonly deletion: AdminStoreDeletionService,
  ) {}

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

  @Post(':storeId/soft-delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Take a store offline, hide it from its merchant and free its address (restorable)' })
  softDelete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Body() dto: SoftDeleteStoreDto,
    @Req() req: Request,
  ) {
    return this.deletion.softDelete(user.userId, storeId, dto.reason, req);
  }

  @Post(':storeId/restore')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Restore a soft-deleted store' })
  restore(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Body() dto: RestoreStoreDto,
    @Req() req: Request,
  ) {
    return this.deletion.restore(user.userId, storeId, dto.slug, req);
  }

  @Post(':storeId/permanent-delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Permanently delete a store and everything in it (type the address to confirm)' })
  deletePermanently(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Body() dto: PermanentDeleteStoreDto,
    @Req() req: Request,
  ) {
    return this.deletion.deletePermanently(user.userId, storeId, dto.confirmSlug, req);
  }
}
