import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import { UpdateStoreSettingsDto } from './dto/store-settings.dto';
import { StoreSettingsService } from './store-settings.service';
import { StoresService } from './stores.service';

@ApiTags('stores')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller({ path: 'stores', version: '1' })
export class StoresController {
  constructor(
    private readonly storesService: StoresService,
    private readonly settings: StoreSettingsService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List stores accessible to the current merchant user',
  })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.storesService.listAccessible(user.userId);
  }

  @Get(':storeId')
  @ApiOperation({ summary: 'Get a store by id when authorized' })
  getOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
  ) {
    return this.storesService.getById(user.userId, storeId);
  }

  @Get(':storeId/settings')
  @ApiOperation({ summary: 'Merchant store settings (any store member)' })
  getSettings(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
  ) {
    return this.settings.get(user.userId, storeId);
  }

  @Patch(':storeId/settings')
  @ApiOperation({
    summary: 'Update merchant store settings (store manager / tenant owner or admin)',
  })
  updateSettings(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Body() dto: UpdateStoreSettingsDto,
    @Req() req: Request,
  ) {
    return this.settings.update(user.userId, storeId, dto, req);
  }

  @Get(':storeId/settings/summary')
  @ApiOperation({
    summary: 'Payments, shipping, domains and theme overview for the settings home',
  })
  settingsSummary(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
  ) {
    return this.settings.summary(user.userId, storeId);
  }
}
