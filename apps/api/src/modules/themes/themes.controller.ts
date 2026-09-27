import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import { UpdateStoreThemeDto } from './dto/store-theme.dto';
import { ThemesService } from './themes.service';

@ApiTags('themes')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller({ path: 'stores/:storeId', version: '1' })
export class ThemesController {
  constructor(private readonly themes: ThemesService) {}

  @Get('themes')
  @ApiOperation({ summary: 'List installable themes with the selected flag' })
  listThemes(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
  ) {
    return this.themes.listThemes(user.userId, storeId);
  }

  @Get('theme')
  @ApiOperation({
    summary: 'Get the active store theme with draft and published config',
  })
  getStoreTheme(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
  ) {
    return this.themes.getStoreTheme(user.userId, storeId);
  }

  @Patch('theme')
  @ApiOperation({ summary: 'Switch theme and/or patch the draft configuration' })
  updateStoreTheme(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Body() dto: UpdateStoreThemeDto,
    @Req() req: Request,
  ) {
    return this.themes.updateStoreTheme(user.userId, storeId, dto, req);
  }

  @Post('theme/publish')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Publish the draft configuration to the storefront' })
  publish(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Req() req: Request,
  ) {
    return this.themes.publish(user.userId, storeId, req);
  }

  @Post('theme/reset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset the draft configuration to theme defaults' })
  reset(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Req() req: Request,
  ) {
    return this.themes.reset(user.userId, storeId, req);
  }

  @Post('theme/preview')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Draft configuration for authenticated storefront preview',
  })
  preview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
  ) {
    return this.themes.getPreview(user.userId, storeId);
  }
}
