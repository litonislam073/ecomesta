import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { PublicCheckoutService } from './public-checkout.service';
import { PublicStorefrontController } from './public-storefront.controller';
import { PublicStorefrontService } from './public-storefront.service';

@Module({
  imports: [OrdersModule],
  controllers: [PublicStorefrontController],
  providers: [PublicStorefrontService, PublicCheckoutService],
})
export class PublicStorefrontModule {}
