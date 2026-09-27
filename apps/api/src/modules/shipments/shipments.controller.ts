import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import { CreateShipmentDto, UpdateShipmentDto } from './dto/shipment.dto';
import { ShipmentsService } from './shipments.service';

@ApiTags('shipments')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller({
  path: 'stores/:storeId/orders/:orderId/shipments',
  version: '1',
})
export class ShipmentsController {
  constructor(private readonly shipmentsService: ShipmentsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a shipment for an order' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: CreateShipmentDto,
    @Req() req: Request,
  ) {
    return this.shipmentsService.create(
      user.userId,
      storeId,
      orderId,
      dto,
      req,
    );
  }

  @Get()
  @ApiOperation({ summary: 'List shipments for an order' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ) {
    return this.shipmentsService.list(user.userId, storeId, orderId);
  }

  @Patch(':shipmentId')
  @ApiOperation({ summary: 'Update a shipment (status/tracking)' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Param('shipmentId', ParseUUIDPipe) shipmentId: string,
    @Body() dto: UpdateShipmentDto,
    @Req() req: Request,
  ) {
    return this.shipmentsService.update(
      user.userId,
      storeId,
      orderId,
      shipmentId,
      dto,
      req,
    );
  }
}
