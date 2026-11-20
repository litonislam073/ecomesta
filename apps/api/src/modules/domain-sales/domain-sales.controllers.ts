import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import { DomainSalesService } from './domain-sales.service';
import {
  CreateDomainOrderDto,
  DomainSearchQueryDto,
  ListDomainOrdersQueryDto,
  RejectDomainOrderDto,
  RenewDomainDto,
  UpdateDomainSalesSettingsDto,
} from './dto/domain-sales.dto';

/** Domain search on the website and dashboard; no sign-in needed. */
@ApiTags('domains')
@Controller({ path: 'public/domains', version: '1' })
export class PublicDomainSalesController {
  constructor(private readonly sales: DomainSalesService) {}

  @Get('search')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Check a name on every offered extension, with prices in taka' })
  search(@Query() query: DomainSearchQueryDto) {
    return this.sales.search(query.q);
  }
}

/** Buying and renewing domains for a store's business. */
@ApiTags('domains')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller({ path: 'stores/:storeId/domain-sales', version: '1' })
export class DomainSalesController {
  constructor(private readonly sales: DomainSalesService) {}

  @Get()
  @ApiOperation({ summary: 'Domains bought through Ecomesta and their orders' })
  list(@CurrentUser() user: AuthenticatedUser, @Param('storeId', ParseUUIDPipe) storeId: string) {
    return this.sales.listForStore(user.userId, storeId);
  }

  @Post('orders')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Order a domain, paid by mobile wallet; waits for review' })
  order(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Body() dto: CreateDomainOrderDto,
    @Req() req: Request,
  ) {
    return this.sales.createOrder(user.userId, storeId, dto, req);
  }

  @Post(':registeredDomainId/renew')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Renew a domain, paid by mobile wallet; waits for review' })
  renew(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('registeredDomainId', ParseUUIDPipe) registeredDomainId: string,
    @Body() dto: RenewDomainDto,
    @Req() req: Request,
  ) {
    return this.sales.createRenewal(user.userId, storeId, registeredDomainId, dto, req);
  }
}

/** Super Admin: review domain payments, pricing and the registrar balance. */
@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('SUPER_ADMIN')
@Controller({ path: 'admin/domain-sales', version: '1' })
export class AdminDomainSalesController {
  constructor(private readonly sales: DomainSalesService) {}

  @Get('orders')
  @ApiOperation({ summary: 'List domain orders' })
  list(@Query() query: ListDomainOrdersQueryDto) {
    return this.sales.adminList(query);
  }

  @Post('orders/:orderId/approve')
  @HttpCode(200)
  @ApiOperation({ summary: 'Approve the payment: register or renew the domain at the registrar' })
  approve(@CurrentUser() user: AuthenticatedUser, @Param('orderId', ParseUUIDPipe) orderId: string, @Req() req: Request) {
    return this.sales.approve(user.userId, orderId, req);
  }

  @Post('orders/:orderId/reject')
  @HttpCode(200)
  @ApiOperation({ summary: 'Reject the payment' })
  reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: RejectDomainOrderDto,
    @Req() req: Request,
  ) {
    return this.sales.reject(user.userId, orderId, dto.reason, req);
  }

  @Get('settings')
  @ApiOperation({ summary: 'Domain pricing and offered extensions' })
  async settings() {
    return { success: true as const, data: await this.sales.settings() };
  }

  @Patch('settings')
  @ApiOperation({ summary: 'Update the dollar rate, profit, extensions or switch sales off' })
  updateSettings(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateDomainSalesSettingsDto, @Req() req: Request) {
    return this.sales.updateSettings(user.userId, dto, req);
  }

  @Get('balance')
  @ApiOperation({ summary: 'Registrar account balance (USD)' })
  balance() {
    return this.sales.registrarBalance();
  }
}
