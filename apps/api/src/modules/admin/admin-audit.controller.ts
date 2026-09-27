import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import { AdminAuditService } from './admin-audit.service';
import { ListAdminAuditLogsQueryDto } from './dto/admin-audit.dto';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('SUPER_ADMIN')
@Controller({ path: 'admin/audit-logs', version: '1' })
export class AdminAuditController {
  constructor(private readonly auditLogs: AdminAuditService) {}

  @Get()
  @ApiOperation({ summary: 'Search platform audit logs' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListAdminAuditLogsQueryDto,
  ) {
    return this.auditLogs.list(user.userId, query);
  }
}
