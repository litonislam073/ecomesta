import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BillingCycle } from '@prisma/client';
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

  @ApiPropertyOptional({ example: 'growth', description: 'Starts the free trial on this plan' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? normalizeSlug(value) : value,
  )
  @Matches(SLUG_REGEX)
  planSlug?: string;

  @ApiPropertyOptional({ enum: BillingCycle, description: 'Defaults to MONTHLY when a plan is given' })
  @IsOptional()
  @IsIn(Object.values(BillingCycle))
  billingCycle?: BillingCycle;
}
