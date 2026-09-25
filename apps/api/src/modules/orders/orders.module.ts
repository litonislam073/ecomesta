import { Module } from '@nestjs/common';
import { OrderPlacementService } from './order-placement.service';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  controllers: [OrdersController],
  providers: [OrdersService, OrderPlacementService],
  exports: [OrdersService, OrderPlacementService],
})
export class OrdersModule {}
