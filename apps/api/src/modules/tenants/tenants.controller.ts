import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { TenantsService } from './tenants.service';
import { CreateStoreDto } from '../stores/dto/create-store.dto';
import { StoresService } from '../stores/stores.service';

@ApiTags('tenants')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller({ path: 'tenants', version: '1' })
export class TenantsController {
  constructor(
    private readonly tenantsService: TenantsService,
    private readonly storesService: StoresService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a tenant and become OWNER' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTenantDto,
    @Req() req: Request,
  ) {
    return this.tenantsService.create(user.userId, dto, req);
  }

  @Get()
  @ApiOperation({ summary: 'List tenants accessible to the current user' })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.tenantsService.listForUser(user.userId, user.platformRole);
  }

  @Get(':tenantId')
  @ApiOperation({ summary: 'Get a tenant by id when authorized' })
  getOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
  ) {
    return this.tenantsService.getById(user.userId, tenantId);
  }

  @Get(':tenantId/members')
  @ApiOperation({ summary: 'List tenant members (OWNER/ADMIN)' })
  listMembers(
    @CurrentUser() user: AuthenticatedUser,
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
  ) {
    return this.tenantsService.listMembers(user.userId, tenantId);
  }

  @Post(':tenantId/stores')
  @ApiOperation({ summary: 'Create a store in a tenant (OWNER/ADMIN)' })
  createStore(
    @CurrentUser() user: AuthenticatedUser,
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Body() dto: CreateStoreDto,
    @Req() req: Request,
  ) {
    return this.storesService.createForTenant(user.userId, tenantId, dto, req);
  }

  @Get(':tenantId/stores')
  @ApiOperation({ summary: 'List stores in a tenant accessible to the user' })
  listStores(
    @CurrentUser() user: AuthenticatedUser,
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
  ) {
    return this.storesService.listForTenant(user.userId, tenantId);
  }
}
