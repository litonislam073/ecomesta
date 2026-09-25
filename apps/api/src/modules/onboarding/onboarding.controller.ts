import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import { OnboardStoreDto } from './dto/onboard-store.dto';
import { OnboardingService } from './onboarding.service';

@ApiTags('onboarding')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller({ path: 'onboarding', version: '1' })
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Post('store')
  @ApiOperation({
    summary: 'Create first tenant + store atomically for the current user',
  })
  onboard(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: OnboardStoreDto,
    @Req() req: Request,
  ) {
    return this.onboardingService.createTenantAndStore(user.userId, dto, req);
  }
}
