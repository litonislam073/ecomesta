import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import { AffiliatesService } from './affiliates.service';
import {
  AdminAffiliateListQueryDto,
  AdminAffiliateRateDto,
  AdminAffiliateReasonDto,
  AdminPayoutListQueryDto,
  AdminPayoutPaidDto,
  AffiliateSettingsDto,
} from './dto/affiliate.dto';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('SUPER_ADMIN')
@Controller({ path: 'admin/affiliates', version: '1' })
export class AdminAffiliatesController {
  constructor(private readonly affiliates: AffiliatesService) {}

  @Get()
  @ApiOperation({ summary: 'Affiliates with stats and balances' })
  list(@Query() query: AdminAffiliateListQueryDto) {
    return this.affiliates.adminList(query);
  }

  @Get('settings')
  settings() {
    return this.affiliates.adminSettings();
  }

  @Patch('settings')
  @ApiOperation({ summary: 'Commission rate, cookie days, hold days and minimum payout' })
  updateSettings(@CurrentUser() user: AuthenticatedUser, @Body() dto: AffiliateSettingsDto, @Req() req: Request) {
    return this.affiliates.adminUpdateSettings(user.userId, dto, req);
  }

  @Get('commissions')
  commissions() {
    return this.affiliates.adminCommissions();
  }

  @Post('commissions/:commissionId/reject')
  @HttpCode(200)
  @ApiOperation({ summary: 'Reject a commission while it is on hold' })
  rejectCommission(
    @CurrentUser() user: AuthenticatedUser,
    @Param('commissionId', ParseUUIDPipe) commissionId: string,
    @Body() dto: AdminAffiliateReasonDto,
    @Req() req: Request,
  ) {
    return this.affiliates.adminRejectCommission(user.userId, commissionId, dto.reason, req);
  }

  @Get('payouts')
  payouts(@Query() query: AdminPayoutListQueryDto) {
    return this.affiliates.adminPayouts(query);
  }

  @Post('payouts/:payoutId/paid')
  @HttpCode(200)
  @ApiOperation({ summary: 'Mark a withdrawal as sent' })
  payoutPaid(
    @CurrentUser() user: AuthenticatedUser,
    @Param('payoutId', ParseUUIDPipe) payoutId: string,
    @Body() dto: AdminPayoutPaidDto,
    @Req() req: Request,
  ) {
    return this.affiliates.adminMarkPayout(user.userId, payoutId, { paid: dto.transactionId }, req);
  }

  @Post('payouts/:payoutId/reject')
  @HttpCode(200)
  payoutReject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('payoutId', ParseUUIDPipe) payoutId: string,
    @Body() dto: AdminAffiliateReasonDto,
    @Req() req: Request,
  ) {
    return this.affiliates.adminMarkPayout(user.userId, payoutId, { rejected: dto.reason }, req);
  }

  @Post(':affiliateId/approve')
  @HttpCode(200)
  approve(@CurrentUser() user: AuthenticatedUser, @Param('affiliateId', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.affiliates.adminSetStatus(user.userId, id, 'approve', null, req);
  }

  @Post(':affiliateId/reject')
  @HttpCode(200)
  reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('affiliateId', ParseUUIDPipe) id: string,
    @Body() dto: AdminAffiliateReasonDto,
    @Req() req: Request,
  ) {
    return this.affiliates.adminSetStatus(user.userId, id, 'reject', dto.reason, req);
  }

  @Post(':affiliateId/suspend')
  @HttpCode(200)
  suspend(
    @CurrentUser() user: AuthenticatedUser,
    @Param('affiliateId', ParseUUIDPipe) id: string,
    @Body() dto: AdminAffiliateReasonDto,
    @Req() req: Request,
  ) {
    return this.affiliates.adminSetStatus(user.userId, id, 'suspend', dto.reason, req);
  }

  @Post(':affiliateId/reactivate')
  @HttpCode(200)
  reactivate(@CurrentUser() user: AuthenticatedUser, @Param('affiliateId', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.affiliates.adminSetStatus(user.userId, id, 'reactivate', null, req);
  }

  @Patch(':affiliateId/rate')
  @ApiOperation({ summary: 'Custom commission rate for one affiliate (null = program rate)' })
  rate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('affiliateId', ParseUUIDPipe) id: string,
    @Body() dto: AdminAffiliateRateDto,
    @Req() req: Request,
  ) {
    return this.affiliates.adminSetRate(user.userId, id, dto.rate, req);
  }
}
