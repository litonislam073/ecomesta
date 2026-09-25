import { Body, Controller, Get, Headers, Param, Post, Query, Req } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import {
  PublicCheckoutDto,
  PublicOrderLookupQueryDto,
} from './dto/public-checkout.dto';
import {
  ListPublicCategoriesQueryDto,
  ListPublicProductsQueryDto,
} from './dto/public-storefront.dto';
import { PublicCheckoutService } from './public-checkout.service';
import { PublicStorefrontService } from './public-storefront.service';

@ApiTags('public-storefront')
@Controller({ path: 'public/stores/:storeSlug', version: '1' })
export class PublicStorefrontController {
  constructor(
    private readonly publicStorefront: PublicStorefrontService,
    private readonly publicCheckout: PublicCheckoutService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get public store profile by slug (ACTIVE only)' })
  getStore(@Param('storeSlug') storeSlug: string) {
    return this.publicStorefront.getStore(storeSlug);
  }

  @Get('categories')
  @ApiOperation({ summary: 'List public categories for a store' })
  listCategories(
    @Param('storeSlug') storeSlug: string,
    @Query() query: ListPublicCategoriesQueryDto,
  ) {
    return this.publicStorefront.listCategories(storeSlug, query);
  }

  @Get('categories/:categorySlug')
  @ApiOperation({ summary: 'Get a public category by slug' })
  getCategory(
    @Param('storeSlug') storeSlug: string,
    @Param('categorySlug') categorySlug: string,
  ) {
    return this.publicStorefront.getCategory(storeSlug, categorySlug);
  }

  @Get('products')
  @ApiOperation({ summary: 'List public ACTIVE products for a store' })
  listProducts(
    @Param('storeSlug') storeSlug: string,
    @Query() query: ListPublicProductsQueryDto,
  ) {
    return this.publicStorefront.listProducts(storeSlug, query);
  }

  @Get('products/:productSlug')
  @ApiOperation({ summary: 'Get public product detail by slug' })
  getProduct(
    @Param('storeSlug') storeSlug: string,
    @Param('productSlug') productSlug: string,
  ) {
    return this.publicStorefront.getProduct(storeSlug, productSlug);
  }

  @Post('checkout')
  @ApiOperation({
    summary: 'Place a guest checkout order (server-priced, inventory-locked)',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'Client-generated key to prevent duplicate orders',
  })
  checkout(
    @Param('storeSlug') storeSlug: string,
    @Body() dto: PublicCheckoutDto,
    @Req() req: Request,
    @Headers('idempotency-key') _idempotencyKey?: string,
  ) {
    return this.publicCheckout.checkout(storeSlug, dto, req);
  }

  @Get('orders/:publicReference')
  @ApiOperation({
    summary: 'Look up a public order by opaque reference (optional email check)',
  })
  getOrder(
    @Param('storeSlug') storeSlug: string,
    @Param('publicReference') publicReference: string,
    @Query() query: PublicOrderLookupQueryDto,
  ) {
    return this.publicCheckout.getOrder(storeSlug, publicReference, query);
  }
}
