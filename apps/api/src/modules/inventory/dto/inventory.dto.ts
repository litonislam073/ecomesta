import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { InventoryMovementType } from '@prisma/client';

export class AdjustInventoryDto {
  @ApiProperty()
  @IsUUID()
  productId!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUUID()
  variantId?: string | null;

  @ApiProperty({
    description:
      'Signed delta applied to on-hand quantity (positive increases, negative decreases)',
  })
  @Type(() => Number)
  @IsInt()
  quantity!: number;

  @ApiProperty({ enum: InventoryMovementType, default: InventoryMovementType.ADJUSTMENT })
  @IsIn(Object.values(InventoryMovementType))
  type!: InventoryMovementType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class ListInventoryQueryDto {
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
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  variantId?: string;

  @ApiPropertyOptional({ description: 'Search product/variant name or SKU' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({
    enum: ['all', 'in_stock', 'low', 'out'],
    description: 'Stock filter. low uses lowStockThreshold when set, else quantity 1–5.',
  })
  @IsOptional()
  @IsIn(['all', 'in_stock', 'low', 'out'])
  stockStatus?: 'all' | 'in_stock' | 'low' | 'out';
}

export class ListMovementsQueryDto {
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
}
