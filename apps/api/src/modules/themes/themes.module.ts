import { Module } from '@nestjs/common';
import { PublicStorefrontModule } from '../public-storefront/public-storefront.module';
import { PublicThemesController } from './public-themes.controller';
import { PublicThemesService } from './public-themes.service';
import { ThemesController } from './themes.controller';
import { ThemesService } from './themes.service';

@Module({
  imports: [PublicStorefrontModule],
  controllers: [ThemesController, PublicThemesController],
  providers: [ThemesService, PublicThemesService],
  exports: [ThemesService],
})
export class ThemesModule {}
