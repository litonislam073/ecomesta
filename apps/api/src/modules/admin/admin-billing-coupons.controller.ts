import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import { BillingCouponsService } from '../billing/billing-coupons.service';
import { CreateBillingCouponDto, UpdateBillingCouponDto } from '../billing/dto/billing-coupon.dto';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('SUPER_ADMIN')
@Controller({ path: 'admin/billing-coupons', version: '1' })
export class AdminBillingCouponsController {
  constructor(private readonly coupons: BillingCouponsService) {}

  @Get()
  @ApiOperation({ summary: 'Plan payment coupons with how often each was used' })
  list() {
    return this.coupons.adminList();
  }

  @Post()
  @ApiOperation({ summary: 'Create a coupon merchants can use when paying for a plan' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateBillingCouponDto, @Req() req: Request) {
    return this.coupons.create(user.userId, dto, req);
  }

  @Patch(':couponId')
  @ApiOperation({ summary: 'Change a coupon (turn it on or off, limits, dates, plans); the code and discount stay fixed' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('couponId', ParseUUIDPipe) couponId: string,
    @Body() dto: UpdateBillingCouponDto,
    @Req() req: Request,
  ) {
    return this.coupons.update(user.userId, couponId, dto, req);
  }
}
