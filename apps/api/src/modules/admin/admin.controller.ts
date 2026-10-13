import { Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import { AdminBadgesService } from './admin-badges.service';
import { AdminStatsService } from './admin-stats.service';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('SUPER_ADMIN')
@Controller({ path: 'admin', version: '1' })
export class AdminController {
  constructor(
    private readonly stats: AdminStatsService,
    private readonly badges: AdminBadgesService,
  ) {}

  @Get('badges')
  @ApiOperation({ summary: 'Sidebar counters: new accounts since Users was last opened, payments and theme purchases to review' })
  getBadges(@CurrentUser() user: AuthenticatedUser) {
    return this.badges.get(user.userId);
  }

  @Post('badges/users-seen')
  @HttpCode(200)
  @ApiOperation({ summary: 'The admin opened the Users list; the new-users counter starts again' })
  usersSeen(@CurrentUser() user: AuthenticatedUser) {
    return this.badges.markUsersSeen(user.userId);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Platform-wide counters for the Super Admin console' })
  getStats(@CurrentUser() user: AuthenticatedUser) {
    return this.stats.getStats(user.userId);
  }
}
