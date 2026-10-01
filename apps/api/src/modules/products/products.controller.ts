import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import {
  CreateProductDto,
  CreateVariantDto,
  ListProductsQueryDto,
  SetProductImageFromGalleryDto,
  UpdateProductDto,
  UpdateVariantDto,
} from './dto/product.dto';
import { PRODUCT_IMAGE_MAX_BYTES } from './product-image.util';
import { ProductsService, type UploadedImageFile } from './products.service';

@ApiTags('products')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller({ path: 'stores/:storeId/products', version: '1' })
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a product in a store' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Body() dto: CreateProductDto,
    @Req() req: Request,
  ) {
    return this.productsService.create(user.userId, storeId, dto, req);
  }

  @Get()
  @ApiOperation({ summary: 'List products for a store' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Query() query: ListProductsQueryDto,
  ) {
    return this.productsService.list(user.userId, storeId, query);
  }

  @Get(':productId')
  @ApiOperation({ summary: 'Get a product by id' })
  getOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('productId', ParseUUIDPipe) productId: string,
  ) {
    return this.productsService.getOne(user.userId, storeId, productId);
  }

  @Patch(':productId')
  @ApiOperation({ summary: 'Update a product' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() dto: UpdateProductDto,
    @Req() req: Request,
  ) {
    return this.productsService.update(
      user.userId,
      storeId,
      productId,
      dto,
      req,
    );
  }

  @Delete(':productId')
  @ApiOperation({
    summary: 'Archive a product (soft delete via ARCHIVED status)',
  })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Req() req: Request,
  ) {
    return this.productsService.archive(user.userId, storeId, productId, req);
  }

  @Post(':productId/image')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Upload or replace the product image (multipart field "file"; JPEG, PNG or WebP, ≤ 1.5 MB)',
  })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: PRODUCT_IMAGE_MAX_BYTES, files: 1, fields: 0 },
    }),
  )
  setImage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('productId', ParseUUIDPipe) productId: string,
    @UploadedFile() file: UploadedImageFile | undefined,
    @Req() req: Request,
  ) {
    return this.productsService.setImage(user.userId, storeId, productId, file, req);
  }

  @Post(':productId/image/from-gallery')
  @HttpCode(200)
  @ApiOperation({ summary: 'Use an image from the store’s media gallery as the product image' })
  setImageFromGallery(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() dto: SetProductImageFromGalleryDto,
    @Req() req: Request,
  ) {
    return this.productsService.setImageFromGallery(user.userId, storeId, productId, dto.mediaId, req);
  }

  @Delete(':productId/image')
  @ApiOperation({ summary: 'Remove the product image' })
  removeImage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Req() req: Request,
  ) {
    return this.productsService.removeImage(user.userId, storeId, productId, req);
  }

  @Post(':productId/variants')
  @ApiOperation({ summary: 'Create a product variant' })
  createVariant(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() dto: CreateVariantDto,
    @Req() req: Request,
  ) {
    return this.productsService.createVariant(
      user.userId,
      storeId,
      productId,
      dto,
      req,
    );
  }

  @Get(':productId/variants')
  @ApiOperation({ summary: 'List variants for a product' })
  listVariants(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('productId', ParseUUIDPipe) productId: string,
  ) {
    return this.productsService.listVariants(user.userId, storeId, productId);
  }

  @Get(':productId/variants/:variantId')
  @ApiOperation({ summary: 'Get a variant by id' })
  getVariant(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Param('variantId', ParseUUIDPipe) variantId: string,
  ) {
    return this.productsService.getVariant(
      user.userId,
      storeId,
      productId,
      variantId,
    );
  }

  @Patch(':productId/variants/:variantId')
  @ApiOperation({ summary: 'Update a variant' })
  updateVariant(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Param('variantId', ParseUUIDPipe) variantId: string,
    @Body() dto: UpdateVariantDto,
    @Req() req: Request,
  ) {
    return this.productsService.updateVariant(
      user.userId,
      storeId,
      productId,
      variantId,
      dto,
      req,
    );
  }

  @Delete(':productId/variants/:variantId')
  @ApiOperation({ summary: 'Delete a variant' })
  deleteVariant(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Param('variantId', ParseUUIDPipe) variantId: string,
    @Req() req: Request,
  ) {
    return this.productsService.deleteVariant(
      user.userId,
      storeId,
      productId,
      variantId,
      req,
    );
  }
}
