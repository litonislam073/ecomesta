import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import { CourierConnectionsService } from './courier-connections.service';
import { CourierShipmentsService } from './courier-shipments.service';
import { CourierLocationOptionsDto, CreateCourierShipmentDto, UpsertCourierConnectionDto } from './dto/courier.dto';

@ApiTags('couriers')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller({ path: 'stores/:storeId', version: '1' })
export class CouriersController {
  constructor(
    private readonly connections: CourierConnectionsService,
    private readonly shipments: CourierShipmentsService,
  ) {}

  @Get('couriers')
  @ApiOperation({ summary: 'Couriers the store can use and whether each is connected (no credentials)' })
  list(@CurrentUser() user: AuthenticatedUser, @Param('storeId', ParseUUIDPipe) storeId: string) {
    return this.connections.list(user.userId, storeId);
  }

  @Put('couriers/:provider')
  @ApiOperation({ summary: 'Connect a courier or update its settings (credentials are write-only)' })
  upsert(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('provider') provider: string,
    @Body() dto: UpsertCourierConnectionDto,
    @Req() req: Request,
  ) {
    return this.connections.upsert(user.userId, storeId, provider, dto, req);
  }

  @Post('couriers/:provider/location-options')
  @HttpCode(200)
  @ApiOperation({ summary: "Choices for one of a connected courier's booking location steps (e.g. RedX area)" })
  locationOptions(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('provider') provider: string,
    @Body() dto: CourierLocationOptionsDto,
  ) {
    return this.connections.locationOptions(user.userId, storeId, provider, dto);
  }

  @Delete('couriers/:provider')
  @ApiOperation({ summary: 'Disconnect a courier and delete its stored credentials' })
  disconnect(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('provider') provider: string,
    @Req() req: Request,
  ) {
    return this.connections.disconnect(user.userId, storeId, provider, req);
  }

  @Post('orders/:orderId/courier-shipments')
  @ApiOperation({ summary: 'Book a courier parcel for an order (COD amount computed server-side)' })
  createShipment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: CreateCourierShipmentDto,
    @Req() req: Request,
  ) {
    return this.shipments.create(user.userId, storeId, orderId, dto, req);
  }

  @Post('orders/:orderId/shipments/:shipmentId/sync')
  @ApiOperation({ summary: "Refresh a courier shipment's status from the courier" })
  sync(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Param('shipmentId', ParseUUIDPipe) shipmentId: string,
    @Req() req: Request,
  ) {
    return this.shipments.sync(user.userId, storeId, orderId, shipmentId, req);
  }

  @Post('orders/:orderId/shipments/:shipmentId/release')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Mark an unconfirmed courier booking as not booked (merchant checked the courier account); frees the order',
  })
  release(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Param('shipmentId', ParseUUIDPipe) shipmentId: string,
    @Req() req: Request,
  ) {
    return this.shipments.release(user.userId, storeId, orderId, shipmentId, req);
  }
}
