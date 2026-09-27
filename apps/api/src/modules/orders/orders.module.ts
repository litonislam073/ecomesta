import { Module } from '@nestjs/common';
import { CouponsModule } from '../coupons/coupons.module';
import { ShippingModule } from '../shipping/shipping.module';
import { OrderPlacementService } from './order-placement.service';
import { OrderTimelineService } from './order-timeline.service';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [ShippingModule, CouponsModule],
  controllers: [OrdersController],
  providers: [OrdersService, OrderPlacementService, OrderTimelineService],
  exports: [OrdersService, OrderPlacementService, OrderTimelineService],
})
export class OrdersModule {}
