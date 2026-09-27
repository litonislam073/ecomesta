import { Module } from '@nestjs/common';
import { CouponValidationService } from './coupon-validation.service';
import { CouponsController } from './coupons.controller';
import { CouponsService } from './coupons.service';
import { PublicCouponsController } from './public-coupons.controller';
import { PublicCouponsService } from './public-coupons.service';

@Module({
  controllers: [CouponsController, PublicCouponsController],
  providers: [
    CouponsService,
    CouponValidationService,
    PublicCouponsService,
  ],
  exports: [CouponsService, CouponValidationService],
})
export class CouponsModule {}
