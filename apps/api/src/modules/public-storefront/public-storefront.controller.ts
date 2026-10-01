import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { BangladeshLocationsService } from '../shipping/bangladesh-locations.service';
import { ShippingQuoteDto } from '../shipping/dto/shipping-quote.dto';
import { ShippingQuoteService } from '../shipping/shipping-quote.service';
import { ShippingService } from '../shipping/shipping.service';
import {
  CancelPublicOrderDto,
  PublicCheckoutDto,
  PublicCheckoutQuoteDto,
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
    private readonly shipping: ShippingService,
    private readonly shippingQuote: ShippingQuoteService,
    private readonly locations: BangladeshLocationsService,
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

  @Get('locations/divisions')
  @ApiOperation({
    summary: 'List Bangladesh divisions (global; gated by active store)',
  })
  async listDivisions(@Param('storeSlug') storeSlug: string) {
    await this.publicStorefront.requireActiveStore(storeSlug);
    return this.locations.listDivisions();
  }

  @Get('locations/districts')
  @ApiOperation({ summary: 'List districts for a division, or all districts when divisionId is omitted' })
  @ApiQuery({ name: 'divisionId', required: false })
  async listDistricts(
    @Param('storeSlug') storeSlug: string,
    @Query('divisionId') divisionId?: string,
  ) {
    await this.publicStorefront.requireActiveStore(storeSlug);
    return this.locations.listDistricts(divisionId || undefined);
  }

  @Get('locations/upazilas')
  @ApiOperation({ summary: 'List upazilas for a district' })
  @ApiQuery({ name: 'districtId', required: true })
  async listUpazilas(
    @Param('storeSlug') storeSlug: string,
    @Query('districtId') districtId: string,
  ) {
    await this.publicStorefront.requireActiveStore(storeSlug);
    return this.locations.listUpazilas(districtId);
  }

  @Get('shipping-methods')
  @ApiOperation({
    summary:
      'List active public shipping methods (optional zoneId; prefer POST /shipping/quote)',
  })
  @ApiQuery({ name: 'zoneId', required: false })
  async listShippingMethods(
    @Param('storeSlug') storeSlug: string,
    @Query('zoneId') zoneId?: string,
  ) {
    const store = await this.publicStorefront.requireActiveStore(storeSlug);
    return this.shipping.listPublic(store.id, zoneId);
  }

  @Post('shipping/quote')
  @ApiOperation({
    summary:
      'Quote available shipping methods for location + cart (server-priced)',
  })
  async quoteShipping(
    @Param('storeSlug') storeSlug: string,
    @Body() dto: ShippingQuoteDto,
  ) {
    const store = await this.publicStorefront.requireActiveStore(storeSlug);
    return this.shippingQuote.quote(store.id, dto);
  }

  @Post('checkout/quote')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Server-priced checkout summary for the current cart (display only; creates nothing)',
  })
  quoteCheckout(
    @Param('storeSlug') storeSlug: string,
    @Body() dto: PublicCheckoutQuoteDto,
    @Req() req: Request,
  ) {
    return this.publicCheckout.quote(storeSlug, dto, req);
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
    summary:
      'Look up a public order by opaque reference (optional email/phone verification)',
  })
  getOrder(
    @Param('storeSlug') storeSlug: string,
    @Param('publicReference') publicReference: string,
    @Query() query: PublicOrderLookupQueryDto,
    @Req() req: Request,
  ) {
    return this.publicCheckout.getOrder(
      storeSlug,
      publicReference,
      query,
      req,
    );
  }

  @Post('orders/:publicReference/cancel')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Guest cancellation of an unpaid, unfulfilled PENDING/CONFIRMED order (store setting + email/phone proof)',
  })
  cancelOrder(
    @Param('storeSlug') storeSlug: string,
    @Param('publicReference') publicReference: string,
    @Body() dto: CancelPublicOrderDto,
    @Req() req: Request,
  ) {
    return this.publicCheckout.cancelOrder(storeSlug, publicReference, dto, req);
  }
}
