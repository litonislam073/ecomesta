import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import { BillingPaymentsService } from './billing-payments.service';
import { BillingService } from './billing.service';
import { BillingTenantQueryDto, SelectPlanDto, SubmitBillingPaymentDto } from './dto/billing.dto';

@ApiTags('billing')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller({ path: 'billing', version: '1' })
export class BillingController {
  constructor(
    private readonly billing: BillingService,
    private readonly payments: BillingPaymentsService,
  ) {}

  @Get('subscription')
  @ApiOperation({ summary: "Current business account's platform subscription" })
  getSubscription(@CurrentUser() user: AuthenticatedUser, @Query() query: BillingTenantQueryDto) {
    return this.billing.getForUser(user.userId, query.tenant);
  }

  @Post('subscription')
  @ApiOperation({ summary: 'Start the free trial or change plan/billing cycle (no payment taken)' })
  selectPlan(@CurrentUser() user: AuthenticatedUser, @Body() dto: SelectPlanDto, @Req() req: Request) {
    return this.billing.selectPlan(user.userId, dto, req);
  }

  @Get('payment-accounts')
  @ApiOperation({ summary: 'Ecomesta wallet numbers to send subscription payments to' })
  paymentAccounts() {
    return this.payments.accounts();
  }

  @Get('payments')
  @ApiOperation({ summary: "The business's reported subscription payments (newest first)" })
  listPayments(@CurrentUser() user: AuthenticatedUser, @Query() query: BillingTenantQueryDto) {
    return this.payments.listForTenant(user.userId, query.tenant);
  }

  @Post('payments')
  @ApiOperation({
    summary: 'Report a bKash / Nagad / Rocket / Upay payment; the plan activates once Ecomesta approves it',
  })
  submitPayment(@CurrentUser() user: AuthenticatedUser, @Body() dto: SubmitBillingPaymentDto, @Req() req: Request) {
    return this.payments.submit(user.userId, dto, req);
  }
}

@ApiTags('billing')
@Controller({ path: 'public/plans', version: '1' })
export class PublicPlansController {
  constructor(private readonly billing: BillingService) {}

  @Get()
  @ApiOperation({ summary: 'Active subscription plans with BDT prices per billing cycle' })
  list() {
    return this.billing.listPublicPlans();
  }
}
