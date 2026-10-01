import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import { BillingPaymentsService } from '../billing/billing-payments.service';
import { ListBillingPaymentsQueryDto, RejectBillingPaymentDto } from '../billing/dto/billing.dto';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('SUPER_ADMIN')
@Controller({ path: 'admin/billing-payments', version: '1' })
export class AdminBillingPaymentsController {
  constructor(private readonly payments: BillingPaymentsService) {}

  @Get()
  @ApiOperation({ summary: 'Reported subscription payments (pending first when filtered)' })
  list(@Query() query: ListBillingPaymentsQueryDto) {
    return this.payments.adminList(query);
  }

  @Post(':paymentId/approve')
  @HttpCode(200)
  @ApiOperation({ summary: 'Confirm the payment arrived and activate the plan' })
  approve(
    @CurrentUser() user: AuthenticatedUser,
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
    @Req() req: Request,
  ) {
    return this.payments.approve(user.userId, paymentId, req);
  }

  @Post(':paymentId/reject')
  @HttpCode(200)
  @ApiOperation({ summary: 'Reject a payment that could not be confirmed' })
  reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
    @Body() dto: RejectBillingPaymentDto,
    @Req() req: Request,
  ) {
    return this.payments.reject(user.userId, paymentId, dto.reason, req);
  }
}
