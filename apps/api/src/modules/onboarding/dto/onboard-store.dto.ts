import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BillingCycle, ManualPaymentMethod } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { SLUG_REGEX, normalizeSlug } from '../../../common/utils/slug.util';

const CURRENCY_REGEX = /^[A-Z]{3}$/;
const LOCALE_REGEX = /^[a-z]{2}(-[A-Z]{2})?$/;
const TIMEZONE_REGEX = /^[A-Za-z0-9_+\-/]+$/;

export class OnboardStoreDto {
  @ApiProperty({ example: 'Example Business' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  businessName!: string;

  @ApiProperty({ example: 'Example Store' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  storeName!: string;

  @ApiProperty({ example: 'example-business' })
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? normalizeSlug(value) : value,
  )
  @Matches(SLUG_REGEX)
  tenantSlug!: string;

  @ApiProperty({ example: 'example-store' })
  @IsString()
  @MinLength(2)
  // Single DNS label: `{storeSlug}.{PLATFORM_ROOT_DOMAIN}`.
  @MaxLength(63)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? normalizeSlug(value) : value,
  )
  @Matches(SLUG_REGEX)
  storeSlug!: string;

  @ApiPropertyOptional({ example: 'BDT' })
  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @Matches(CURRENCY_REGEX)
  currency?: string;

  @ApiPropertyOptional({ example: 'Asia/Dhaka' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  @Matches(TIMEZONE_REGEX)
  timezone?: string;

  @ApiPropertyOptional({ example: 'en-BD' })
  @IsOptional()
  @IsString()
  @MaxLength(16)
  @Matches(LOCALE_REGEX)
  locale?: string;

  @ApiProperty({ example: 'growth', description: 'Plan the first payment is for' })
  @IsString()
  @MaxLength(120)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? normalizeSlug(value) : value,
  )
  @Matches(SLUG_REGEX)
  planSlug!: string;

  @ApiProperty({ enum: BillingCycle })
  @IsIn(Object.values(BillingCycle))
  billingCycle!: BillingCycle;

  // The first subscription payment, made by mobile wallet before the store
  // is created. The store stays offline until a Super Admin confirms it.
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
