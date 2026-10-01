import {
  Allow,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { ProductStatus, ProductType } from '@prisma/client';
import { SLUG_REGEX, normalizeSlug } from '../../../common/utils/slug.util';

export class CreateProductDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  name!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? normalizeSlug(value) : value,
  )
  @Matches(SLUG_REGEX)
  slug!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  shortDescription?: string;

  @ApiPropertyOptional({ enum: ProductStatus })
  @IsOptional()
  @IsIn([ProductStatus.DRAFT, ProductStatus.ACTIVE])
  status?: ProductStatus;

  @ApiPropertyOptional({ enum: ProductType })
  @IsOptional()
  @IsIn(Object.values(ProductType))
  productType?: ProductType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  sku?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  barcode?: string;

  @ApiProperty({ description: 'Decimal string or number with up to 2 decimals' })
  @IsNotEmpty()
  basePrice!: string | number;

  @ApiPropertyOptional()
  @IsOptional()
  @Allow()
  compareAtPrice?: string | number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Allow()
  costPrice?: string | number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  trackInventory?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  allowBackorder?: boolean;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  categoryIds?: string[];
}

export class UpdateProductDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? normalizeSlug(value) : value,
  )
  @Matches(SLUG_REGEX)
  slug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  description?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  shortDescription?: string | null;

  @ApiPropertyOptional({ enum: ProductStatus })
  @IsOptional()
  @IsIn(Object.values(ProductStatus))
  status?: ProductStatus;

  @ApiPropertyOptional({ enum: ProductType })
  @IsOptional()
  @IsIn(Object.values(ProductType))
  productType?: ProductType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  sku?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  barcode?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Allow()
  basePrice?: string | number;

  @ApiPropertyOptional()
  @IsOptional()
  @Allow()
  compareAtPrice?: string | number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Allow()
  costPrice?: string | number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  trackInventory?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  allowBackorder?: boolean;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  categoryIds?: string[];
}

export class ListProductsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({ enum: ProductStatus })
  @IsOptional()
  @IsIn(Object.values(ProductStatus))
  status?: ProductStatus;

  @ApiPropertyOptional({ enum: ProductType })
  @IsOptional()
  @IsIn(Object.values(ProductType))
  productType?: ProductType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ enum: ['createdAt', 'updatedAt', 'name', 'basePrice'] })
  @IsOptional()
  @IsIn(['createdAt', 'updatedAt', 'name', 'basePrice'])
  sortBy?: 'createdAt' | 'updatedAt' | 'name' | 'basePrice';

  @ApiPropertyOptional({ enum: ['asc', 'desc'] })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';
}

export class CreateVariantDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  sku?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  barcode?: string;

  @ApiProperty()
  @IsNotEmpty()
  price!: string | number;

  @ApiPropertyOptional()
  @IsOptional()
  @Allow()
  compareAtPrice?: string | number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Allow()
  costPrice?: string | number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Allow()
  weight?: string | number | null;

  @ApiPropertyOptional({ enum: ProductStatus })
  @IsOptional()
  @IsIn([ProductStatus.DRAFT, ProductStatus.ACTIVE])
  status?: ProductStatus;
}

export class UpdateVariantDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  sku?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  barcode?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Allow()
  price?: string | number;

  @ApiPropertyOptional()
  @IsOptional()
  @Allow()
  compareAtPrice?: string | number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Allow()
  costPrice?: string | number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Allow()
  weight?: string | number | null;

  @ApiPropertyOptional({ enum: ProductStatus })
  @IsOptional()
  @IsIn(Object.values(ProductStatus))
  status?: ProductStatus;
}

export class SetProductImageFromGalleryDto {
  @ApiProperty({ description: 'Id of an image in this store’s media gallery' })
  @IsUUID()
  mediaId!: string;
}
