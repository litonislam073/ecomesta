import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ShippingMethodType, ShippingProvider } from '@prisma/client';

/** Phase 11 merchant-facing types (simple calculation only). */
export const PHASE11_SHIPPING_TYPES = [
  ShippingMethodType.FLAT,
  ShippingMethodType.FREE,
  ShippingMethodType.WEIGHT_BASED,
  ShippingMethodType.EXTERNAL,
] as const;

export class CreateShippingMethodDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @ApiProperty({ enum: ShippingMethodType, default: ShippingMethodType.FLAT })
  @IsEnum(ShippingMethodType)
  type!: ShippingMethodType;

  @ApiPropertyOptional({
    enum: ShippingProvider,
    default: ShippingProvider.MANUAL,
  })
  @IsOptional()
  @IsEnum(ShippingProvider)
  provider?: ShippingProvider;

  @ApiPropertyOptional({
    description: 'Flat amount; ignored/forced to 0 when type is FREE',
  })
  @IsOptional()
  @IsString()
  price?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({
    description: 'Optional merchant configuration JSON (not exposed publicly)',
  })
  @IsOptional()
  @IsObject()
  configuration?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Bind method to a zone; null = store-wide / legacy',
    nullable: true,
  })
  @IsOptional()
  @IsUUID()
  zoneId?: string | null;

  @ApiPropertyOptional({
    description: 'Free shipping when subtotal after discount >= this amount',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  freeShippingThreshold?: string | null;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  codAllowed?: boolean;

  @ApiPropertyOptional({ example: '1–2 days' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  estimatedDelivery?: string | null;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(-1000)
  @Max(10000)
  sortOrder?: number;
}

export class UpdateShippingMethodDto extends PartialType(
  CreateShippingMethodDto,
) {}

export class ListShippingMethodsQueryDto {
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
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  active?: boolean;

  @ApiPropertyOptional({
    description: 'Filter by zone; use "null" for store-wide',
  })
  @IsOptional()
  @IsString()
  zoneId?: string;

  @ApiPropertyOptional({
    enum: ['createdAt', 'name', 'price', 'updatedAt', 'sortOrder'],
  })
  @IsOptional()
  @IsIn(['createdAt', 'name', 'price', 'updatedAt', 'sortOrder'])
  sortBy?: 'createdAt' | 'name' | 'price' | 'updatedAt' | 'sortOrder';

  @ApiPropertyOptional({ enum: ['asc', 'desc'] })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';
}
