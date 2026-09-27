import { Module } from '@nestjs/common';
import { CouponsModule } from '../coupons/coupons.module';
import { BangladeshLocationsService } from './bangladesh-locations.service';
import { ShippingCalculationService } from './shipping-calculation.service';
import { ShippingController } from './shipping.controller';
import { ShippingLocationsController } from './shipping-locations.controller';
import { ShippingQuoteService } from './shipping-quote.service';
import { ShippingService } from './shipping.service';
import { ShippingZonesController } from './shipping-zones.controller';
import { ShippingZonesService } from './shipping-zones.service';

@Module({
  imports: [CouponsModule],
  controllers: [
    ShippingController,
    ShippingZonesController,
    ShippingLocationsController,
  ],
  providers: [
    ShippingService,
    ShippingZonesService,
    ShippingCalculationService,
    ShippingQuoteService,
    BangladeshLocationsService,
  ],
  exports: [
    ShippingService,
    ShippingZonesService,
    ShippingCalculationService,
    ShippingQuoteService,
    BangladeshLocationsService,
  ],
})
export class ShippingModule {}
