import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
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

export class CreateStoreDto {
  @ApiProperty({ example: 'My Online Store' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  name!: string;

  @ApiProperty({ example: 'my-online-store' })
  @IsString()
  @MinLength(2)
  // Single DNS label: `{slug}.{PLATFORM_ROOT_DOMAIN}`.
  @MaxLength(63)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? normalizeSlug(value) : value,
  )
  @Matches(SLUG_REGEX, {
    message: 'slug must be lowercase URL-friendly (a-z, 0-9, hyphens)',
  })
  slug!: string;

  @ApiPropertyOptional({ example: 'BDT' })
  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @Matches(CURRENCY_REGEX, { message: 'currency must be a 3-letter ISO code' })
  currency?: string;

  @ApiPropertyOptional({ example: 'Asia/Dhaka' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  @Matches(TIMEZONE_REGEX, { message: 'timezone must be an IANA timezone id' })
  timezone?: string;

  @ApiPropertyOptional({ example: 'en-BD' })
  @IsOptional()
  @IsString()
  @MaxLength(16)
  @Matches(LOCALE_REGEX, { message: 'locale must look like en or en-BD' })
  locale?: string;
}
