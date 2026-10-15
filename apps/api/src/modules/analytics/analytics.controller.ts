import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import { AnalyticsIngestService } from './analytics-ingest.service';
import { AnalyticsService } from './analytics.service';
import { AnalyticsEventDto, AnalyticsRangeQueryDto } from './dto/analytics.dto';

@ApiTags('analytics')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller({ path: 'stores/:storeId/analytics', version: '1' })
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get()
  @ApiOperation({ summary: 'Sales and visitor analytics for a date range (30-day sales overview on Starter)' })
  report(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Query() query: AnalyticsRangeQueryDto,
  ) {
    return this.analytics.report(user.userId, storeId, query);
  }

  @Get('export')
  @ApiOperation({ summary: 'Daily sales and visitors as CSV (full analytics)' })
  async export(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Query() query: AnalyticsRangeQueryDto,
    @Res() res: Response,
  ) {
    const { filename, csv } = await this.analytics.exportCsv(user.userId, storeId, query);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    res.send(csv);
  }
}

@ApiTags('analytics')
@Controller({ path: 'public/stores/:storeSlug/analytics', version: '1' })
export class PublicAnalyticsController {
  constructor(private readonly ingest: AnalyticsIngestService) {}

  @Post('events')
  @HttpCode(204)
  @Throttle({ default: { limit: 240, ttl: 60_000 } })
  @ApiOperation({ summary: 'A shopper event from the storefront (no cookies, no personal data)' })
  async event(@Param('storeSlug') storeSlug: string, @Body() dto: AnalyticsEventDto, @Req() req: Request) {
    await this.ingest.record(storeSlug, dto, req);
  }
}
