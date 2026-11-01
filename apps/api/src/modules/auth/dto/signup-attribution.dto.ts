import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';

function trimString({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

/** Optional first-touch attribution sent with register / Google sign-up. */
export class SignupAttributionFieldsDto {
  @ApiPropertyOptional({ example: 'facebook' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(trimString)
  utmSource?: string;

  @ApiPropertyOptional({ example: 'cpc' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(trimString)
  utmMedium?: string;

  @ApiPropertyOptional({ example: 'spring-sale' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  @Transform(trimString)
  utmCampaign?: string;

  @ApiPropertyOptional({ example: 'l.facebook.com' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Transform(trimString)
  referrerHost?: string;

  @ApiPropertyOptional({ example: '/pricing' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Transform(trimString)
  landingPath?: string;
}
