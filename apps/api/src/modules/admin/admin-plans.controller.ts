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
import { AdminPlansService } from './admin-plans.service';
import {
  CreateSubscriptionPlanDto,
  ListAdminPlansQueryDto,
  UpdateSubscriptionPlanDto,
  UpdateSubscriptionPlanStatusDto,
} from './dto/admin-plan.dto';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('SUPER_ADMIN')
@Controller({ path: 'admin/plans', version: '1' })
export class AdminPlansController {
  constructor(private readonly plans: AdminPlansService) {}

  @Get()
  @ApiOperation({ summary: 'List subscription plans' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListAdminPlansQueryDto,
  ) {
    return this.plans.list(user.userId, query);
  }

  @Post()
  @ApiOperation({ summary: 'Create a subscription plan' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateSubscriptionPlanDto,
    @Req() req: Request,
  ) {
    return this.plans.create(user.userId, dto, req);
  }

  @Get(':planId')
  @ApiOperation({ summary: 'Get a subscription plan' })
  getOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('planId', ParseUUIDPipe) planId: string,
  ) {
    return this.plans.getOne(user.userId, planId);
  }

  @Patch(':planId')
  @ApiOperation({ summary: 'Update a subscription plan' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('planId', ParseUUIDPipe) planId: string,
    @Body() dto: UpdateSubscriptionPlanDto,
    @Req() req: Request,
  ) {
    return this.plans.update(user.userId, planId, dto, req);
  }

  @Patch(':planId/status')
  @ApiOperation({ summary: 'Activate or deactivate a subscription plan' })
  updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('planId', ParseUUIDPipe) planId: string,
    @Body() dto: UpdateSubscriptionPlanStatusDto,
    @Req() req: Request,
  ) {
    return this.plans.updateStatus(user.userId, planId, dto, req);
  }
}
