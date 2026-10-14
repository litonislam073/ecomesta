import { Module } from '@nestjs/common';
import { PublicStorefrontModule } from '../public-storefront/public-storefront.module';
import { LandingPagesController, PublicLandingPagesController } from './landing-pages.controller';
import { LandingPagesService } from './landing-pages.service';
import { PublicLandingPagesService } from './public-landing-pages.service';

@Module({
  imports: [PublicStorefrontModule],
  controllers: [LandingPagesController, PublicLandingPagesController],
  providers: [LandingPagesService, PublicLandingPagesService],
})
export class LandingPagesModule {}
