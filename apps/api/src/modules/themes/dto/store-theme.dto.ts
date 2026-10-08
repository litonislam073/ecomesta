import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { THEME_FONT_FAMILIES } from '@ecomesta/utils';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsHexColor,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  StoreThemeConfig,
  THEME_BORDER_RADII,
  THEME_HEADER_LAYOUTS,
  THEME_HERO_ALIGNMENTS,
  THEME_LIMITS,
  THEME_SECTION_TYPES,
  THEME_SOCIAL_NETWORKS,
  ThemeBorderRadius,
  ThemeHeaderLayout,
  ThemeHeroAlignment,
  ThemeSectionType,
  ThemeSocialNetwork,
} from '../theme-config.types';

/**
 * The DTO classes below document the closed config schema for Swagger and give
 * typed section shapes to callers. Runtime enforcement (unknown-key stripping,
 * HTML rejection, URL/color checks) lives in `normalizeThemeConfiguration`,
 * which every write path runs before persisting.
 */

export class ThemeMenuItemDto {
  @ApiPropertyOptional({ maxLength: THEME_LIMITS.label })
  @IsString()
  @MaxLength(THEME_LIMITS.label)
  label!: string;

  @ApiPropertyOptional({ maxLength: THEME_LIMITS.href })
  @IsString()
  @MaxLength(THEME_LIMITS.href)
  href!: string;
}

export class ThemeSocialLinkDto {
  @ApiPropertyOptional({ enum: THEME_SOCIAL_NETWORKS })
  @IsIn(THEME_SOCIAL_NETWORKS)
  network!: ThemeSocialNetwork;

  @ApiPropertyOptional({ maxLength: THEME_LIMITS.url })
  @IsString()
  @MaxLength(THEME_LIMITS.url)
  url!: string;
}

export class ThemeBrandingDto {
  @ApiPropertyOptional({ maxLength: THEME_LIMITS.brandName })
  @IsOptional()
  @IsString()
  @MaxLength(THEME_LIMITS.brandName)
  brandName?: string;

  @ApiPropertyOptional({ maxLength: THEME_LIMITS.tagline })
  @IsOptional()
  @IsString()
  @MaxLength(THEME_LIMITS.tagline)
  tagline?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(THEME_LIMITS.url)
  logoUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(THEME_LIMITS.url)
  faviconUrl?: string;

  @ApiPropertyOptional({ example: '#2563eb' })
  @IsOptional()
  @IsHexColor()
  primaryColor?: string;

  @ApiPropertyOptional({ example: '#1e293b' })
  @IsOptional()
  @IsHexColor()
  secondaryColor?: string;

  @ApiPropertyOptional({ example: '#f59e0b' })
  @IsOptional()
  @IsHexColor()
  accentColor?: string;

  @ApiPropertyOptional({ example: '#ffffff' })
  @IsOptional()
  @IsHexColor()
  backgroundColor?: string;

  @ApiPropertyOptional({ example: '#f8fafc' })
  @IsOptional()
  @IsHexColor()
  surfaceColor?: string;

  @ApiPropertyOptional({ example: '#0f172a' })
  @IsOptional()
  @IsHexColor()
  textColor?: string;

  @ApiPropertyOptional({ example: '#64748b' })
  @IsOptional()
  @IsHexColor()
  mutedTextColor?: string;

  @ApiPropertyOptional({ enum: THEME_BORDER_RADII })
  @IsOptional()
  @IsIn(THEME_BORDER_RADII)
  borderRadius?: ThemeBorderRadius;
}

export class ThemeTypographyDto {
  @ApiPropertyOptional({ enum: THEME_FONT_FAMILIES })
  @IsOptional()
  @IsIn(THEME_FONT_FAMILIES)
  headingFont?: string;

  @ApiPropertyOptional({ enum: THEME_FONT_FAMILIES })
  @IsOptional()
  @IsIn(THEME_FONT_FAMILIES)
  bodyFont?: string;

  @ApiPropertyOptional({
    minimum: THEME_LIMITS.baseFontSizeMin,
    maximum: THEME_LIMITS.baseFontSizeMax,
  })
  @IsOptional()
  @IsNumber()
  @Min(THEME_LIMITS.baseFontSizeMin)
  @Max(THEME_LIMITS.baseFontSizeMax)
  baseFontSize?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(-5)
  @Max(10)
  headingLetterSpacing?: number;
}

export class ThemeAnnouncementDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ maxLength: THEME_LIMITS.announcementText })
  @IsOptional()
  @IsString()
  @MaxLength(THEME_LIMITS.announcementText)
  text?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(THEME_LIMITS.href)
  href?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsHexColor()
  backgroundColor?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsHexColor()
  textColor?: string;
}

export class ThemeHeaderDto {
  @ApiPropertyOptional({ enum: THEME_HEADER_LAYOUTS })
  @IsOptional()
  @IsIn(THEME_HEADER_LAYOUTS)
  layout?: ThemeHeaderLayout;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  sticky?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  showSearch?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  showCart?: boolean;

  @ApiPropertyOptional({
    type: () => [ThemeMenuItemDto],
    maxItems: THEME_LIMITS.menuItems,
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(THEME_LIMITS.menuItems)
  @ValidateNested({ each: true })
  @Type(() => ThemeMenuItemDto)
  menuItems?: ThemeMenuItemDto[];
}

export class ThemeHeroDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ maxLength: THEME_LIMITS.title })
  @IsOptional()
  @IsString()
  @MaxLength(THEME_LIMITS.title)
  headline?: string;

  @ApiPropertyOptional({ maxLength: THEME_LIMITS.description })
  @IsOptional()
  @IsString()
  @MaxLength(THEME_LIMITS.description)
  subheadline?: string;

  @ApiPropertyOptional({ maxLength: THEME_LIMITS.label })
  @IsOptional()
  @IsString()
  @MaxLength(THEME_LIMITS.label)
  ctaLabel?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(THEME_LIMITS.href)
  ctaHref?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(THEME_LIMITS.url)
  imageUrl?: string;

  @ApiPropertyOptional({ enum: THEME_HERO_ALIGNMENTS })
  @IsOptional()
  @IsIn(THEME_HERO_ALIGNMENTS)
  alignment?: ThemeHeroAlignment;

  @ApiPropertyOptional({ minimum: 0, maximum: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  overlayOpacity?: number;
}

export class ThemeHomepageSectionDto {
  @ApiPropertyOptional({ enum: THEME_SECTION_TYPES })
  @IsIn(THEME_SECTION_TYPES)
  type!: ThemeSectionType;

  @ApiPropertyOptional({ maxLength: THEME_LIMITS.title })
  @IsOptional()
  @IsString()
  @MaxLength(THEME_LIMITS.title)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class ThemeHomepageDto {
  @ApiPropertyOptional({ type: [String], maxItems: THEME_LIMITS.featuredIds })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(THEME_LIMITS.featuredIds)
  @IsUUID('4', { each: true })
  featuredCategories?: string[];

  @ApiPropertyOptional({ type: [String], maxItems: THEME_LIMITS.featuredIds })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(THEME_LIMITS.featuredIds)
  @IsUUID('4', { each: true })
  featuredProducts?: string[];

  @ApiPropertyOptional({
    type: () => [ThemeHomepageSectionDto],
    maxItems: THEME_LIMITS.sections,
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(THEME_LIMITS.sections)
  @ValidateNested({ each: true })
  @Type(() => ThemeHomepageSectionDto)
  sections?: ThemeHomepageSectionDto[];
}

export class ThemeFooterDto {
  @ApiPropertyOptional({ maxLength: THEME_LIMITS.tagline })
  @IsOptional()
  @IsString()
  @MaxLength(THEME_LIMITS.tagline)
  tagline?: string;

  @ApiPropertyOptional({ maxLength: THEME_LIMITS.tagline })
  @IsOptional()
  @IsString()
  @MaxLength(THEME_LIMITS.tagline)
  copyright?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  showPaymentIcons?: boolean;

  @ApiPropertyOptional({
    type: () => [ThemeMenuItemDto],
    maxItems: THEME_LIMITS.menuItems,
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(THEME_LIMITS.menuItems)
  @ValidateNested({ each: true })
  @Type(() => ThemeMenuItemDto)
  menuItems?: ThemeMenuItemDto[];

  @ApiPropertyOptional({
    type: () => [ThemeSocialLinkDto],
    maxItems: THEME_LIMITS.socialLinks,
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(THEME_LIMITS.socialLinks)
  @ValidateNested({ each: true })
  @Type(() => ThemeSocialLinkDto)
  socialLinks?: ThemeSocialLinkDto[];
}

export class ThemeSeoDto {
  @ApiPropertyOptional({ maxLength: THEME_LIMITS.title })
  @IsOptional()
  @IsString()
  @MaxLength(THEME_LIMITS.title)
  title?: string;

  @ApiPropertyOptional({ maxLength: THEME_LIMITS.description })
  @IsOptional()
  @IsString()
  @MaxLength(THEME_LIMITS.description)
  description?: string;

  @ApiPropertyOptional({ type: [String], maxItems: THEME_LIMITS.keywords })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(THEME_LIMITS.keywords)
  @IsString({ each: true })
  @MaxLength(THEME_LIMITS.keyword, { each: true })
  keywords?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(THEME_LIMITS.url)
  ogImageUrl?: string;
}

export class ThemeConfigurationDto implements StoreThemeConfig {
  @ApiPropertyOptional({ type: () => ThemeBrandingDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => ThemeBrandingDto)
  branding?: ThemeBrandingDto;

  @ApiPropertyOptional({ type: () => ThemeTypographyDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => ThemeTypographyDto)
  typography?: ThemeTypographyDto;

  @ApiPropertyOptional({ type: () => ThemeAnnouncementDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => ThemeAnnouncementDto)
  announcement?: ThemeAnnouncementDto;

  @ApiPropertyOptional({ type: () => ThemeHeaderDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => ThemeHeaderDto)
  header?: ThemeHeaderDto;

  @ApiPropertyOptional({ type: () => ThemeHeroDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => ThemeHeroDto)
  hero?: ThemeHeroDto;

  @ApiPropertyOptional({ type: () => ThemeHomepageDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => ThemeHomepageDto)
  homepage?: ThemeHomepageDto;

  @ApiPropertyOptional({ type: () => ThemeFooterDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => ThemeFooterDto)
  footer?: ThemeFooterDto;

  @ApiPropertyOptional({ type: () => ThemeSeoDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => ThemeSeoDto)
  seo?: ThemeSeoDto;
}

export class UpdateStoreThemeDto {
  @ApiPropertyOptional({ description: 'Switch the store to another theme' })
  @IsOptional()
  @IsUUID()
  themeId?: string;

  @ApiPropertyOptional({
    type: () => ThemeConfigurationDto,
    description:
      'Partial draft configuration; unknown keys are stripped server-side',
  })
  @IsOptional()
  @IsObject()
  configuration?: Record<string, unknown>;
}

export class ThemePreviewSessionDto {
  @ApiPropertyOptional({ description: 'Theme to preview; defaults to the selected theme' })
  @IsOptional()
  @IsUUID()
  themeId?: string;

  @ApiPropertyOptional({
    type: () => ThemeConfigurationDto,
    description: 'The full unsaved draft configuration to show',
  })
  @IsOptional()
  @IsObject()
  configuration?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Token of the open preview, to update it in place' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  token?: string;
}
