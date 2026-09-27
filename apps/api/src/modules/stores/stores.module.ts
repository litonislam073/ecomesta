import { Module } from '@nestjs/common';
import { DomainsModule } from '../domains/domains.module';
import { StoreSettingsService } from './store-settings.service';
import { StoresController } from './stores.controller';
import { StoresService } from './stores.service';

@Module({
  imports: [DomainsModule],
  controllers: [StoresController],
  providers: [StoresService, StoreSettingsService],
  exports: [StoresService],
})
export class StoresModule {}
