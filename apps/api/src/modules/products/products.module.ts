import { Module } from '@nestjs/common';
import { MediaLibraryController } from './media-library.controller';
import { MediaLibraryService } from './media-library.service';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { PublicMediaController } from './public-media.controller';

@Module({
  controllers: [ProductsController, MediaLibraryController, PublicMediaController],
  providers: [ProductsService, MediaLibraryService],
  exports: [ProductsService, MediaLibraryService],
})
export class ProductsModule {}
