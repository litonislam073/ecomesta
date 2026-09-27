import {
  Body,
  Controller,
  Delete,
  Get,
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
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import {
  CreateShippingZoneDto,
  ListShippingZonesQueryDto,
  UpdateShippingZoneDto,
} from './dto/shipping-zone.dto';
import { ShippingZonesService } from './shipping-zones.service';

@ApiTags('shipping-zones')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller({ path: 'stores/:storeId/shipping-zones', version: '1' })
export class ShippingZonesController {
  constructor(private readonly zonesService: ShippingZonesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a shipping zone with location mappings' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Body() dto: CreateShippingZoneDto,
    @Req() req: Request,
  ) {
    return this.zonesService.create(user.userId, storeId, dto, req);
  }

  @Get()
  @ApiOperation({ summary: 'List shipping zones for a store' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Query() query: ListShippingZonesQueryDto,
  ) {
    return this.zonesService.list(user.userId, storeId, query);
  }

  @Get(':zoneId')
  @ApiOperation({ summary: 'Get a shipping zone' })
  getOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('zoneId', ParseUUIDPipe) zoneId: string,
  ) {
    return this.zonesService.getOne(user.userId, storeId, zoneId);
  }

  @Patch(':zoneId')
  @ApiOperation({ summary: 'Update a shipping zone' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('zoneId', ParseUUIDPipe) zoneId: string,
    @Body() dto: UpdateShippingZoneDto,
    @Req() req: Request,
  ) {
    return this.zonesService.update(user.userId, storeId, zoneId, dto, req);
  }

  @Delete(':zoneId')
  @ApiOperation({ summary: 'Delete a shipping zone' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('zoneId', ParseUUIDPipe) zoneId: string,
    @Req() req: Request,
  ) {
    return this.zonesService.remove(user.userId, storeId, zoneId, req);
  }
}
