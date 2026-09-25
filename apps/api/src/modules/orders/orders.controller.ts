import {
  Body,
  Controller,
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
  CreateOrderDto,
  ListOrdersQueryDto,
  UpdateFulfillmentStatusDto,
  UpdateOrderStatusDto,
  UpdatePaymentStatusDto,
} from './dto/order.dto';
import { OrdersService } from './orders.service';

@ApiTags('orders')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller({ path: 'stores/:storeId/orders', version: '1' })
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @ApiOperation({ summary: 'Create a store order (manual / internal)' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Body() dto: CreateOrderDto,
    @Req() req: Request,
  ) {
    return this.ordersService.create(user.userId, storeId, dto, req);
  }

  @Get()
  @ApiOperation({ summary: 'List orders for a store' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Query() query: ListOrdersQueryDto,
  ) {
    return this.ordersService.list(user.userId, storeId, query);
  }

  @Get(':orderId')
  @ApiOperation({ summary: 'Get order detail' })
  getOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ) {
    return this.ordersService.getOne(user.userId, storeId, orderId);
  }

  @Patch(':orderId/status')
  @ApiOperation({ summary: 'Update order status (validated transitions)' })
  updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: UpdateOrderStatusDto,
    @Req() req: Request,
  ) {
    return this.ordersService.updateStatus(
      user.userId,
      storeId,
      orderId,
      dto,
      req,
    );
  }

  @Patch(':orderId/payment-status')
  @ApiOperation({
    summary: 'Update payment status (internal foundation; no gateway)',
  })
  updatePaymentStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: UpdatePaymentStatusDto,
    @Req() req: Request,
  ) {
    return this.ordersService.updatePaymentStatus(
      user.userId,
      storeId,
      orderId,
      dto,
      req,
    );
  }

  @Patch(':orderId/fulfillment-status')
  @ApiOperation({ summary: 'Update fulfillment status' })
  updateFulfillmentStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: UpdateFulfillmentStatusDto,
    @Req() req: Request,
  ) {
    return this.ordersService.updateFulfillmentStatus(
      user.userId,
      storeId,
      orderId,
      dto,
      req,
    );
  }
}
