import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import { CreateSupportRequestDto } from './dto/support-request.dto';
import { SupportService } from './support.service';

@ApiTags('support')
@Controller({ path: 'support', version: '1' })
export class SupportController {
  constructor(private readonly support: SupportService) {}

  @Get('contact')
  @ApiOperation({ summary: 'Public support contact details' })
  contact() {
    return this.support.contact();
  }

  @Post('requests')
  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Send a support request to the Ecomesta team' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateSupportRequestDto,
    @Req() req: Request,
  ) {
    return this.support.createRequest(user.userId, dto, req);
  }
}
