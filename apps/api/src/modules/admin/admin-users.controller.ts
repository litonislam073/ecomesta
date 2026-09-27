import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { AdminUsersService } from './admin-users.service';
import {
  ListAdminUsersQueryDto,
  UpdateUserPlatformRoleDto,
  UpdateUserStatusDto,
} from './dto/admin-user.dto';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('SUPER_ADMIN')
@Controller({ path: 'admin/users', version: '1' })
export class AdminUsersController {
  constructor(private readonly users: AdminUsersService) {}

  @Get()
  @ApiOperation({ summary: 'List platform users' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListAdminUsersQueryDto,
  ) {
    return this.users.list(user.userId, query);
  }

  @Get(':userId')
  @ApiOperation({ summary: 'Get a user with tenant and store memberships' })
  getOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.users.getOne(user.userId, userId);
  }

  @Patch(':userId/status')
  @ApiOperation({ summary: 'Suspend or reactivate a user' })
  updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: UpdateUserStatusDto,
    @Req() req: Request,
  ) {
    return this.users.updateStatus(user.userId, userId, dto, req);
  }

  @Patch(':userId/platform-role')
  @ApiOperation({ summary: 'Grant or revoke the Super Admin platform role' })
  updatePlatformRole(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: UpdateUserPlatformRoleDto,
    @Req() req: Request,
  ) {
    return this.users.updatePlatformRole(user.userId, userId, dto, req);
  }
}
