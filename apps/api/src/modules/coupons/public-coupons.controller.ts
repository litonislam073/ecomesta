import { Body, Controller, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PublicValidateCouponDto } from './dto/public-coupon.dto';
import { PublicCouponsService } from './public-coupons.service';

@ApiTags('public-coupons')
@Controller({ path: 'public/stores/:storeSlug/coupons', version: '1' })
export class PublicCouponsController {
  constructor(private readonly publicCoupons: PublicCouponsService) {}

  @Post('validate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Validate a coupon against current catalog prices (no trust of client money)',
  })
  validate(
    @Param('storeSlug') storeSlug: string,
    @Body() dto: PublicValidateCouponDto,
  ) {
    return this.publicCoupons.validate(storeSlug, dto);
  }
}
