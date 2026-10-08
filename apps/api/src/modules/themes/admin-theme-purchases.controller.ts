import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import { ListThemePurchasesQueryDto, RejectThemePurchaseDto } from './dto/theme-purchase.dto';
import { ThemePurchasesService } from './theme-purchases.service';

/** Super Admin review of premium theme payments. */
@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('SUPER_ADMIN')
@Controller({ path: 'admin/theme-purchases', version: '1' })
export class AdminThemePurchasesController {
  constructor(private readonly purchases: ThemePurchasesService) {}

  @Get()
  @ApiOperation({ summary: 'List premium theme payments' })
  list(@Query() query: ListThemePurchasesQueryDto) {
    return this.purchases.adminList(query);
  }

  @Post(':purchaseId/approve')
  @HttpCode(200)
  @ApiOperation({ summary: 'Approve a theme payment: the theme unlocks for the business' })
  approve(
    @CurrentUser() user: AuthenticatedUser,
    @Param('purchaseId', ParseUUIDPipe) purchaseId: string,
    @Req() req: Request,
  ) {
    return this.purchases.approve(user.userId, purchaseId, req);
  }

  @Post(':purchaseId/reject')
  @HttpCode(200)
  @ApiOperation({ summary: 'Reject a theme payment' })
  reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('purchaseId', ParseUUIDPipe) purchaseId: string,
    @Body() dto: RejectThemePurchaseDto,
    @Req() req: Request,
  ) {
    return this.purchases.reject(user.userId, purchaseId, dto.reason, req);
  }
}
