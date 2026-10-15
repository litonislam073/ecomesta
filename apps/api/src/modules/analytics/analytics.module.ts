import { Module } from '@nestjs/common';
import { PublicStorefrontModule } from '../public-storefront/public-storefront.module';
import { AnalyticsIngestService } from './analytics-ingest.service';
import { AnalyticsRetentionScheduler } from './analytics-retention.scheduler';
import { AnalyticsController, PublicAnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';

@Module({
  imports: [PublicStorefrontModule],
  controllers: [AnalyticsController, PublicAnalyticsController],
  providers: [AnalyticsService, AnalyticsIngestService, AnalyticsRetentionScheduler],
})
export class AnalyticsModule {}
