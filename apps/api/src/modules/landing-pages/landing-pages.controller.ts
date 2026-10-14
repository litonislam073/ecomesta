import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import {
  CreateLandingPageDto,
  LandingPreviewDto,
  PublicLandingPageQueryDto,
  UpdateLandingPageDto,
} from './dto/landing-page.dto';
import { LandingPagesService } from './landing-pages.service';
import { PublicLandingPagesService } from './public-landing-pages.service';

@ApiTags('landing-pages')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller({ path: 'stores/:storeId/landing-pages', version: '1' })
export class LandingPagesController {
  constructor(private readonly landingPages: LandingPagesService) {}

  @Get()
  @ApiOperation({ summary: "List the store's landing pages and the plan's page allowance" })
  list(@CurrentUser() user: AuthenticatedUser, @Param('storeId', ParseUUIDPipe) storeId: string) {
    return this.landingPages.list(user.userId, storeId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a landing page from a template (with demo content)' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Body() dto: CreateLandingPageDto,
    @Req() req: Request,
  ) {
    return this.landingPages.create(user.userId, storeId, dto, req);
  }

  @Get(':pageId')
  @ApiOperation({ summary: 'Get a landing page with its draft content' })
  getOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('pageId', ParseUUIDPipe) pageId: string,
  ) {
    return this.landingPages.getOne(user.userId, storeId, pageId);
  }

  @Patch(':pageId')
  @ApiOperation({ summary: "Save a landing page's name, address or draft content" })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('pageId', ParseUUIDPipe) pageId: string,
    @Body() dto: UpdateLandingPageDto,
    @Req() req: Request,
  ) {
    return this.landingPages.update(user.userId, storeId, pageId, dto, req);
  }

  @Post(':pageId/publish')
  @ApiOperation({ summary: 'Publish the saved draft' })
  publish(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('pageId', ParseUUIDPipe) pageId: string,
    @Req() req: Request,
  ) {
    return this.landingPages.publish(user.userId, storeId, pageId, req);
  }

  @Post(':pageId/unpublish')
  @ApiOperation({ summary: 'Take the page offline' })
  unpublish(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('pageId', ParseUUIDPipe) pageId: string,
    @Req() req: Request,
  ) {
    return this.landingPages.unpublish(user.userId, storeId, pageId, req);
  }

  @Post(':pageId/preview')
  @ApiOperation({ summary: "Store the editor's unsaved content for the storefront preview" })
  preview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('pageId', ParseUUIDPipe) pageId: string,
    @Body() dto: LandingPreviewDto,
  ) {
    return this.landingPages.preview(user.userId, storeId, pageId, dto);
  }

  @Delete(':pageId')
  @ApiOperation({ summary: 'Delete a landing page (its orders stay)' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('pageId', ParseUUIDPipe) pageId: string,
    @Req() req: Request,
  ) {
    return this.landingPages.remove(user.userId, storeId, pageId, req);
  }
}

@ApiTags('public-landing-pages')
@Controller({ path: 'public/stores/:storeSlug/landing-pages', version: '1' })
export class PublicLandingPagesController {
  constructor(private readonly publicLandingPages: PublicLandingPagesService) {}

  @Get(':pageSlug')
  @ApiOperation({ summary: 'A published landing page with its products (or the editor preview)' })
  getPage(
    @Param('storeSlug') storeSlug: string,
    @Param('pageSlug') pageSlug: string,
    @Query() query: PublicLandingPageQueryDto,
  ) {
    return this.publicLandingPages.getPage(storeSlug, pageSlug, query.previewToken);
  }
}
