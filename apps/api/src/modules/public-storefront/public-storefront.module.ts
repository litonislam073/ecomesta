import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { ShippingModule } from '../shipping/shipping.module';
import { PublicCheckoutService } from './public-checkout.service';
import { PublicStorefrontController } from './public-storefront.controller';
import { PublicStorefrontService } from './public-storefront.service';

@Module({
  imports: [OrdersModule, ShippingModule],
  controllers: [PublicStorefrontController],
  providers: [PublicStorefrontService, PublicCheckoutService],
  exports: [PublicStorefrontService],
})
export class PublicStorefrontModule {}
