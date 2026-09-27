import { Module } from '@nestjs/common';
import { DemoCatalogController } from './demo-catalog.controller';
import { DemoCatalogService } from './demo-catalog.service';

@Module({
  controllers: [DemoCatalogController],
  providers: [DemoCatalogService],
})
export class DemoCatalogModule {}
