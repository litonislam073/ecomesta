import { Global, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminAffiliatesController } from './admin-affiliates.controller';
import { AffiliateSettingsService } from './affiliate-settings.service';
import { AffiliatesController, PublicAffiliateController } from './affiliates.controller';
import { AffiliatesService } from './affiliates.service';

/** Global so sign-up, onboarding and billing can credit referrals. */
@Global()
@Module({
  imports: [AuthModule],
  controllers: [AffiliatesController, PublicAffiliateController, AdminAffiliatesController],
  providers: [AffiliatesService, AffiliateSettingsService],
  exports: [AffiliatesService],
})
export class AffiliatesModule {}
