import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsObject, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { LANDING_SLUG_MAX, LANDING_SLUG_PATTERN, LANDING_TEMPLATE_KEYS, type LandingTemplateKey } from '@ecomesta/utils';

export class CreateLandingPageDto {
  @ApiProperty({ example: 'Eid offer' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  title!: string;

  @ApiProperty({ enum: LANDING_TEMPLATE_KEYS })
  @IsIn(LANDING_TEMPLATE_KEYS)
  template!: LandingTemplateKey;

  @ApiPropertyOptional({ description: 'Address under the store (/lp/{slug}); made from the title when empty' })
  @IsOptional()
  @IsString()
  @MaxLength(LANDING_SLUG_MAX)
  @Matches(LANDING_SLUG_PATTERN, { message: 'Use lowercase letters, numbers and hyphens only' })
  slug?: string;
}

export class UpdateLandingPageDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(LANDING_SLUG_MAX)
  @Matches(LANDING_SLUG_PATTERN, { message: 'Use lowercase letters, numbers and hyphens only' })
  slug?: string;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true, description: 'Draft content; validated against the template' })
  @IsOptional()
  @IsObject()
  content?: Record<string, unknown>;
}

export class LandingPreviewDto {
  @ApiProperty({ type: 'object', additionalProperties: true, description: "The editor's unsaved content" })
  @IsObject()
  content!: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Token of the open preview, kept while it still belongs to this page' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  token?: string;
}

export class PublicLandingPageQueryDto {
  @ApiPropertyOptional({ description: "The landing page editor's preview token" })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  previewToken?: string;
}
