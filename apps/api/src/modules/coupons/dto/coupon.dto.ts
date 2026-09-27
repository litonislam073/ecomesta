import {
  Allow,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { CouponType } from '@prisma/client';

/** Phase 14 engine supports percentage and fixed only (not FREE_SHIPPING). */
export const MERCHANT_COUPON_TYPES = [
  CouponType.PERCENTAGE,
  CouponType.FIXED_AMOUNT,
] as const;

export class CreateCouponDto {
  @ApiProperty({ example: 'SUMMER10' })
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  code!: string;

  @ApiProperty({ enum: MERCHANT_COUPON_TYPES })
  @IsIn(MERCHANT_COUPON_TYPES)
  type!: (typeof MERCHANT_COUPON_TYPES)[number];

  @ApiProperty({ description: 'Percentage (0-100] or fixed money amount' })
  @Allow()
  value!: string | number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startsAt?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expiresAt?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  usageLimit?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1_000)
  perCustomerLimit?: number | null;

  @ApiPropertyOptional({ description: 'Minimum merchandise subtotal' })
  @IsOptional()
  @Allow()
  minimumOrderAmount?: string | number | null;

  @ApiPropertyOptional({ description: 'Cap on computed discount' })
  @IsOptional()
  @Allow()
  maximumDiscountAmount?: string | number | null;
}

export class UpdateCouponDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  code?: string;

  @ApiPropertyOptional({ enum: MERCHANT_COUPON_TYPES })
  @IsOptional()
  @IsIn(MERCHANT_COUPON_TYPES)
  type?: (typeof MERCHANT_COUPON_TYPES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @Allow()
  value?: string | number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startsAt?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expiresAt?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  usageLimit?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1_000)
  perCustomerLimit?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Allow()
  minimumOrderAmount?: string | number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Allow()
  maximumDiscountAmount?: string | number | null;
}

export class ListCouponsQueryDto {
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
  @MaxLength(64)
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({ enum: MERCHANT_COUPON_TYPES })
  @IsOptional()
  @IsIn(MERCHANT_COUPON_TYPES)
  type?: (typeof MERCHANT_COUPON_TYPES)[number];

  @ApiPropertyOptional({ enum: ['createdAt', 'code', 'expiresAt', 'usageCount'] })
  @IsOptional()
  @IsIn(['createdAt', 'code', 'expiresAt', 'usageCount'])
  sortBy?: 'createdAt' | 'code' | 'expiresAt' | 'usageCount';

  @ApiPropertyOptional({ enum: ['asc', 'desc'] })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';
}
