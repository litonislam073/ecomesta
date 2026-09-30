import { Controller, Get, Param, ParseUUIDPipe, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { ProductsService } from './products.service';

/**
 * Serves uploaded product images to storefronts on other origins. Ids are
 * random and each upload gets a new id, so responses are cached forever.
 */
@ApiTags('public-media')
@Controller({ path: 'public/media', version: '1' })
export class PublicMediaController {
  constructor(private readonly productsService: ProductsService) {}

  @Get(':mediaId')
  @Throttle({ default: { limit: 600, ttl: 60_000 } })
  @ApiOperation({ summary: 'Get an uploaded product image' })
  async get(
    @Param('mediaId', ParseUUIDPipe) mediaId: string,
    @Res() res: Response,
  ) {
    const file = await this.productsService.getMediaFile(mediaId);
    res.set({
      'Content-Type': file.mimeType,
      'Content-Length': String(file.data.length),
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
      // Helmet defaults to same-origin, which would block storefront <img> tags.
      'Cross-Origin-Resource-Policy': 'cross-origin',
    });
    res.send(file.data);
  }
}
