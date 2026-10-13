import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BillingCouponType, BillingCycle } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { SelectPlanDto } from './billing.dto';

/** Merchant: what a coupon takes off a plan before paying. */
export class QuoteBillingCouponDto extends SelectPlanDto {
  @ApiProperty({ example: 'EID25' })
  @IsString()
  @MaxLength(40)
  code!: string;
}

/** Fields an admin can change on a coupon (the code and discount stay fixed). */
export class UpdateBillingCouponDto {
  @ApiPropertyOptional({ description: 'Note for the team and the merchant, e.g. "Eid offer"' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string | null;

  @ApiPropertyOptional({ type: [String], description: 'Plan slugs it works for; empty = every plan' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @Matches(/^[a-z0-9-]{1,64}$/, { each: true })
  planSlugs?: string[];

  @ApiPropertyOptional({ enum: BillingCycle, isArray: true, description: 'Billing periods it works for; empty = every period' })
  @IsOptional()
  @IsArray()
  @IsIn(Object.values(BillingCycle), { each: true })
  billingCycles?: BillingCycle[];

  @ApiPropertyOptional({ nullable: true, description: 'Total uses; null = unlimited' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  maxRedemptions?: number | null;

  @ApiPropertyOptional({ nullable: true, description: 'Uses per business; null = unlimited' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  maxPerTenant?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsISO8601()
  startsAt?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsISO8601()
  endsAt?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class CreateBillingCouponDto extends UpdateBillingCouponDto {
  @ApiProperty({ example: 'EID25', description: '3–32 letters, numbers, dashes or underscores' })
  @IsString()
  @MaxLength(32)
  code!: string;

  @ApiProperty({ enum: BillingCouponType })
  @IsIn(Object.values(BillingCouponType))
  type!: BillingCouponType;

  @ApiProperty({ example: 25, description: 'Percent (1–99) or whole taka off' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 0 })
  @Min(1)
  @Max(1_000_000)
  value!: number;
}
