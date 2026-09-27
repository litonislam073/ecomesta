import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { EmailStatusService } from '../email/email-status.service';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('SUPER_ADMIN')
@Controller({ path: 'admin/email', version: '1' })
export class AdminEmailController {
  constructor(private readonly emailStatus: EmailStatusService) {}

  @Get()
  @ApiOperation({ summary: 'Email configuration (no credentials) and recent delivery log' })
  overview() {
    return this.emailStatus.overview();
  }
}
