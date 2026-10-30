import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import { OnboardStoreDto, ReopenStoreDto } from './dto/onboard-store.dto';
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

  @Get('existing-business')
  @ApiOperation({ summary: 'Your business that has no store left, with the plan a new store would keep' })
  existingBusiness(@CurrentUser() user: AuthenticatedUser) {
    return this.onboardingService.getReusableBusiness(user.userId);
  }

  @Post('reopen-store')
  @ApiOperation({ summary: 'Open a new store in your existing business on the plan it already has' })
  reopenStore(@CurrentUser() user: AuthenticatedUser, @Body() dto: ReopenStoreDto, @Req() req: Request) {
    return this.onboardingService.reopenStore(user.userId, dto, req);
  }
}
