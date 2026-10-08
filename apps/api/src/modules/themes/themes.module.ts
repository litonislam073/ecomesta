import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PublicStorefrontModule } from '../public-storefront/public-storefront.module';
import { AdminThemePurchasesController } from './admin-theme-purchases.controller';
import { PublicThemesController } from './public-themes.controller';
import { PublicThemesService } from './public-themes.service';
import { ThemeAccessService } from './theme-access.service';
import { ThemePurchasesService } from './theme-purchases.service';
import { ThemesController } from './themes.controller';
import { ThemePreviewService } from './theme-preview.service';
import { ThemesService } from './themes.service';

@Module({
  imports: [PublicStorefrontModule, AuthModule],
  controllers: [ThemesController, PublicThemesController, AdminThemePurchasesController],
  providers: [ThemesService, PublicThemesService, ThemeAccessService, ThemePurchasesService, ThemePreviewService],
  exports: [ThemesService],
})
export class ThemesModule {}
