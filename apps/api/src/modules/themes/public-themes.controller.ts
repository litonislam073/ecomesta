import { Controller, Get, Header, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PublicThemesService } from './public-themes.service';

@ApiTags('public-storefront')
@Controller({ path: 'public/stores/:storeSlug', version: '1' })
export class PublicThemesController {
  constructor(private readonly publicThemes: PublicThemesService) {}

  @Get('theme')
  @ApiOperation({
    summary: 'Published storefront theme configuration (ACTIVE stores only)',
  })
  @Header('Cache-Control', 'no-store')
  getTheme(@Param('storeSlug') storeSlug: string, @Query('preview') preview?: string) {
    return this.publicThemes.getPublishedTheme(storeSlug, typeof preview === 'string' ? preview : undefined);
  }
}
