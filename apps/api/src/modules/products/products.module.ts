import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { PublicMediaController } from './public-media.controller';

@Module({
  controllers: [ProductsController, PublicMediaController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
