import {
  Body,
  Controller,
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
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import { AdminSubscriptionsService } from './admin-subscriptions.service';
import {
  CreateSubscriptionDto,
  ListAdminSubscriptionsQueryDto,
  UpdateSubscriptionStatusDto,
} from './dto/admin-subscription.dto';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('SUPER_ADMIN')
@Controller({ path: 'admin/subscriptions', version: '1' })
export class AdminSubscriptionsController {
  constructor(private readonly subscriptions: AdminSubscriptionsService) {}

  @Get()
  @ApiOperation({ summary: 'List tenant subscriptions' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListAdminSubscriptionsQueryDto,
  ) {
    return this.subscriptions.list(user.userId, query);
  }

  @Post()
  @ApiOperation({ summary: 'Assign a subscription plan to a tenant' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateSubscriptionDto,
    @Req() req: Request,
  ) {
    return this.subscriptions.create(user.userId, dto, req);
  }

  @Get(':subscriptionId')
  @ApiOperation({ summary: 'Get a subscription with tenant and plan' })
  getOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('subscriptionId', ParseUUIDPipe) subscriptionId: string,
  ) {
    return this.subscriptions.getOne(user.userId, subscriptionId);
  }

  @Patch(':subscriptionId/status')
  @ApiOperation({ summary: 'Move a subscription through its lifecycle' })
  updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('subscriptionId', ParseUUIDPipe) subscriptionId: string,
    @Body() dto: UpdateSubscriptionStatusDto,
    @Req() req: Request,
  ) {
    return this.subscriptions.updateStatus(
      user.userId,
      subscriptionId,
      dto,
      req,
    );
  }
}
