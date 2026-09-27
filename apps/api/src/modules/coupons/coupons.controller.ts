import {
  Body,
  Controller,
  Delete,
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
  CreateCouponDto,
  ListCouponsQueryDto,
  UpdateCouponDto,
} from './dto/coupon.dto';
import { CouponsService } from './coupons.service';

@ApiTags('coupons')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller({ path: 'stores/:storeId/coupons', version: '1' })
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a store coupon' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Body() dto: CreateCouponDto,
    @Req() req: Request,
  ) {
    return this.couponsService.create(user.userId, storeId, dto, req);
  }

  @Get()
  @ApiOperation({ summary: 'List store coupons' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Query() query: ListCouponsQueryDto,
  ) {
    return this.couponsService.list(user.userId, storeId, query);
  }

  @Get(':couponId')
  @ApiOperation({ summary: 'Get a coupon' })
  getOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('couponId', ParseUUIDPipe) couponId: string,
  ) {
    return this.couponsService.getOne(user.userId, storeId, couponId);
  }

  @Patch(':couponId')
  @ApiOperation({ summary: 'Update a coupon' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('couponId', ParseUUIDPipe) couponId: string,
    @Body() dto: UpdateCouponDto,
    @Req() req: Request,
  ) {
    return this.couponsService.update(
      user.userId,
      storeId,
      couponId,
      dto,
      req,
    );
  }

  @Delete(':couponId')
  @ApiOperation({
    summary: 'Delete unused coupon, or deactivate if it has usage history',
  })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('couponId', ParseUUIDPipe) couponId: string,
    @Req() req: Request,
  ) {
    return this.couponsService.remove(user.userId, storeId, couponId, req);
  }
}
