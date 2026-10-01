import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BillingCycle, BillingPaymentStatus, ManualPaymentMethod } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { SLUG_REGEX, normalizeSlug } from '../../../common/utils/slug.util';

const toSlug = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? normalizeSlug(value) : value;

export class BillingTenantQueryDto {
  @ApiPropertyOptional({ description: 'Tenant slug; defaults to your first business account' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  @Transform(toSlug)
  @Matches(SLUG_REGEX)
  tenant?: string;
}

export class SelectPlanDto extends BillingTenantQueryDto {
  @ApiProperty({ example: 'growth' })
  @IsString()
  @MaxLength(120)
  @Transform(toSlug)
  @Matches(SLUG_REGEX)
  planSlug!: string;

  @ApiProperty({ enum: BillingCycle })
  @IsIn(Object.values(BillingCycle))
  billingCycle!: BillingCycle;
}

export class SubmitBillingPaymentDto extends SelectPlanDto {
  @ApiProperty({ enum: ManualPaymentMethod })
  @IsIn(Object.values(ManualPaymentMethod))
  method!: ManualPaymentMethod;

  @ApiProperty({ example: '01712345678', description: 'Wallet number the merchant paid from' })
  @IsString()
  @MaxLength(20)
  senderNumber!: string;

  @ApiProperty({ example: 'BKA7XY12QZ', description: 'Transaction ID from the wallet payment message' })
  @IsString()
  @MaxLength(40)
  transactionId!: string;
}

export class ListBillingPaymentsQueryDto {
  @ApiPropertyOptional({ enum: BillingPaymentStatus })
  @IsOptional()
  @IsIn(Object.values(BillingPaymentStatus))
  status?: BillingPaymentStatus;

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

export class RejectBillingPaymentDto {
  @ApiProperty({ example: 'No payment with this transaction ID reached our bKash number.' })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}
