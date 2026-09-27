import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export const STORE_LANGUAGES = ['en', 'bn'] as const;
export type StoreLanguage = (typeof STORE_LANGUAGES)[number];

export const STORE_SETTINGS_LIMITS = {
  name: 120,
  description: 1000,
  email: 255,
  phone: 40,
  address: 500,
  seoTitle: 120,
  seoDescription: 320,
  keyword: 60,
  keywords: 20,
  ogTitle: 120,
  ogDescription: 320,
  url: 2048,
} as const;

const NO_MARKUP = /^[^<>]*$/;
const NO_MARKUP_MESSAGE = (field: string) => `${field} must be plain text (no < or >)`;
const PHONE_REGEX = /^\+?[0-9][0-9\s\-()]{5,38}$/;

/** Trims strings and turns empty strings into null so fields can be cleared. */
const trimToNull = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') {
    return value;
  }
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};

const isProvided = (_: object, value: unknown) => value !== undefined;
const isPresent = (_: object, value: unknown) => value !== undefined && value !== null;

/**
 * Merchant-editable store settings. Anything not declared here (tenantId,
 * slug, status, currency, timezone, …) is rejected by the global
 * `forbidNonWhitelisted` validation pipe.
 */
export class UpdateStoreSettingsDto {
  @ApiPropertyOptional({
    description:
      'updatedAt from the last GET. When set, the save fails with 409 if someone else changed settings since.',
  })
  @IsOptional()
  @IsISO8601()
  expectedUpdatedAt?: string;

  @ApiPropertyOptional({ maxLength: STORE_SETTINGS_LIMITS.name })
  @ValidateIf(isProvided)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(2)
  @MaxLength(STORE_SETTINGS_LIMITS.name)
  @Matches(NO_MARKUP, { message: NO_MARKUP_MESSAGE('name') })
  name?: string;

  @ApiPropertyOptional({ nullable: true, maxLength: STORE_SETTINGS_LIMITS.description })
  @Transform(trimToNull)
  @ValidateIf(isPresent)
  @IsString()
  @MaxLength(STORE_SETTINGS_LIMITS.description)
  description?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Public store contact email' })
  @Transform(trimToNull)
  @ValidateIf(isPresent)
  @IsEmail({}, { message: 'email must be a valid email address' })
  @MaxLength(STORE_SETTINGS_LIMITS.email)
  email?: string | null;

  @ApiPropertyOptional({ nullable: true, example: '+8801712345678' })
  @Transform(trimToNull)
  @ValidateIf(isPresent)
  @IsString()
  @Matches(PHONE_REGEX, { message: 'phone must be a valid phone number' })
  phone?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: STORE_SETTINGS_LIMITS.address })
  @Transform(trimToNull)
  @ValidateIf(isPresent)
  @IsString()
  @MaxLength(STORE_SETTINGS_LIMITS.address)
  @Matches(NO_MARKUP, { message: NO_MARKUP_MESSAGE('address') })
  address?: string | null;

  @ApiPropertyOptional({ enum: STORE_LANGUAGES })
  @ValidateIf(isProvided)
  @IsIn(STORE_LANGUAGES, { message: 'defaultLanguage must be one of: en, bn' })
  defaultLanguage?: StoreLanguage;

  @ApiPropertyOptional({ description: 'Require a phone number at checkout' })
  @ValidateIf(isProvided)
  @IsBoolean()
  checkoutRequirePhone?: boolean;

  @ApiPropertyOptional({ description: 'Accept an order note at checkout' })
  @ValidateIf(isProvided)
  @IsBoolean()
  checkoutAllowOrderNotes?: boolean;

  @ApiPropertyOptional({
    description: 'Let guests cancel unpaid, unfulfilled PENDING/CONFIRMED orders',
  })
  @ValidateIf(isProvided)
  @IsBoolean()
  allowCustomerCancellation?: boolean;

  @ApiPropertyOptional({ nullable: true, maxLength: STORE_SETTINGS_LIMITS.seoTitle })
  @Transform(trimToNull)
  @ValidateIf(isPresent)
  @IsString()
  @MaxLength(STORE_SETTINGS_LIMITS.seoTitle)
  @Matches(NO_MARKUP, { message: NO_MARKUP_MESSAGE('seoTitle') })
  seoTitle?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: STORE_SETTINGS_LIMITS.seoDescription })
  @Transform(trimToNull)
  @ValidateIf(isPresent)
  @IsString()
  @MaxLength(STORE_SETTINGS_LIMITS.seoDescription)
  @Matches(NO_MARKUP, { message: NO_MARKUP_MESSAGE('seoDescription') })
  seoDescription?: string | null;

  @ApiPropertyOptional({ type: [String], maxItems: STORE_SETTINGS_LIMITS.keywords })
  @ValidateIf(isProvided)
  @Transform(({ value }: { value: unknown }) =>
    Array.isArray(value)
      ? value.map((item) => (typeof item === 'string' ? item.trim() : item))
      : value,
  )
  @IsArray()
  @ArrayMaxSize(STORE_SETTINGS_LIMITS.keywords)
  @IsString({ each: true })
  @MaxLength(STORE_SETTINGS_LIMITS.keyword, { each: true })
  @Matches(NO_MARKUP, { each: true, message: NO_MARKUP_MESSAGE('seoKeywords') })
  seoKeywords?: string[];

  @ApiPropertyOptional({ nullable: true, maxLength: STORE_SETTINGS_LIMITS.ogTitle })
  @Transform(trimToNull)
  @ValidateIf(isPresent)
  @IsString()
  @MaxLength(STORE_SETTINGS_LIMITS.ogTitle)
  @Matches(NO_MARKUP, { message: NO_MARKUP_MESSAGE('ogTitle') })
  ogTitle?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: STORE_SETTINGS_LIMITS.ogDescription })
  @Transform(trimToNull)
  @ValidateIf(isPresent)
  @IsString()
  @MaxLength(STORE_SETTINGS_LIMITS.ogDescription)
  @Matches(NO_MARKUP, { message: NO_MARKUP_MESSAGE('ogDescription') })
  ogDescription?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Absolute http(s) image URL' })
  @Transform(trimToNull)
  @ValidateIf(isPresent)
  @IsString()
  @MaxLength(STORE_SETTINGS_LIMITS.url)
  @IsUrl(
    { protocols: ['http', 'https'], require_protocol: true, require_tld: false },
    { message: 'ogImageUrl must be an http(s) URL' },
  )
  ogImageUrl?: string | null;

  @ApiPropertyOptional({ description: 'Allow search engines to index the storefront' })
  @ValidateIf(isProvided)
  @IsBoolean()
  seoIndexingEnabled?: boolean;
}

export function localeForLanguage(language: StoreLanguage): string {
  return language === 'bn' ? 'bn-BD' : 'en-BD';
}

export function languageForLocale(locale: string | null | undefined): StoreLanguage {
  return locale?.toLowerCase().startsWith('bn') ? 'bn' : 'en';
}
