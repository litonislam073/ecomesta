import { Body, Controller, Get, HttpCode, Post, Put, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { clientIp } from '../../common/utils/request-host.util';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import { AffiliatesService } from './affiliates.service';
import { AffiliateClickDto, AffiliatePayoutMethodDto, ApplyAffiliateDto } from './dto/affiliate.dto';

@ApiTags('affiliates')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller({ path: 'affiliate', version: '1' })
export class AffiliatesController {
  constructor(private readonly affiliates: AffiliatesService) {}

  @Get('me')
  @ApiOperation({ summary: 'My affiliate status, link, stats and balance' })
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.affiliates.me(user.userId);
  }

  @Post('apply')
  @HttpCode(200)
  @ApiOperation({ summary: 'Apply to the affiliate program (a Super Admin approves)' })
  apply(@CurrentUser() user: AuthenticatedUser, @Body() dto: ApplyAffiliateDto, @Req() req: Request) {
    return this.affiliates.apply(user.userId, dto, req);
  }

  @Put('payout-method')
  @ApiOperation({ summary: 'Where withdrawals are sent (bKash, Nagad, Rocket or Upay)' })
  payoutMethod(@CurrentUser() user: AuthenticatedUser, @Body() dto: AffiliatePayoutMethodDto) {
    return this.affiliates.setPayoutMethod(user.userId, dto);
  }

  @Get('referrals')
  referrals(@CurrentUser() user: AuthenticatedUser) {
    return this.affiliates.referrals(user.userId);
  }

  @Get('commissions')
  commissions(@CurrentUser() user: AuthenticatedUser) {
    return this.affiliates.commissions(user.userId);
  }

  @Get('payouts')
  payouts(@CurrentUser() user: AuthenticatedUser) {
    return this.affiliates.payouts(user.userId);
  }

  @Post('payouts')
  @HttpCode(200)
  @ApiOperation({ summary: 'Withdraw the available balance' })
  requestPayout(@CurrentUser() user: AuthenticatedUser, @Req() req: Request) {
    return this.affiliates.requestPayout(user.userId, req);
  }
}

@ApiTags('affiliates')
@Controller({ path: 'public/affiliate', version: '1' })
export class PublicAffiliateController {
  constructor(private readonly affiliates: AffiliatesService) {}

  @Post('click')
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'A visit through a referral link' })
  click(@Body() dto: AffiliateClickDto, @Req() req: Request) {
    return this.affiliates.click(dto.code, clientIp(req) ?? 'unknown');
  }
}
