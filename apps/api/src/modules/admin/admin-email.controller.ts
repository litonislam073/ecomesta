import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ListEmailDeliveriesQueryDto } from '../email/dto/admin-email.dto';
import { EmailStatusService } from '../email/email-status.service';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('SUPER_ADMIN')
@Controller({ path: 'admin/email', version: '1' })
export class AdminEmailController {
  constructor(private readonly emailStatus: EmailStatusService) {}

  @Get()
  @ApiOperation({ summary: 'Email configuration (no credentials) and 7-day status counts' })
  overview() {
    return this.emailStatus.overview();
  }

  @Get('deliveries')
  @ApiOperation({ summary: 'Paginated transactional email delivery log' })
  listDeliveries(@Query() query: ListEmailDeliveriesQueryDto) {
    return this.emailStatus.listDeliveries(query);
  }

  @Get('deliveries/:id')
  @ApiOperation({ summary: 'Single email delivery detail' })
  getDelivery(@Param('id', ParseUUIDPipe) id: string) {
    return this.emailStatus.getDelivery(id);
  }
}
