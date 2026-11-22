import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  Allow,
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { AdminPaginationQueryDto } from './admin-common.dto';

/**
 * Query booleans arrive as strings. With ValidationPipe
 * `enableImplicitConversion`, `Boolean("false") === true` runs before a naive
 * `@Transform(({ value }) => …)`, so Inactive filters would match Active rows.
 * Read the raw query value from `obj` instead.
 */
function parseQueryBoolean({
  obj,
  key,
}: {
  value: unknown;
  obj: Record<string, unknown>;
  key: string;
}): boolean | undefined {
  const raw = obj[key];
  if (raw === undefined || raw === null || raw === '') return undefined;
  if (raw === true || raw === 'true' || raw === '1' || raw === 1) return true;
  if (raw === false || raw === 'false' || raw === '0' || raw === 0) return false;
  return undefined;
}

export class ListAdminPlansQueryDto extends AdminPaginationQueryDto {
  @ApiPropertyOptional({ description: 'Partial name or slug match' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(parseQueryBoolean)
  @IsBoolean()
  active?: boolean;
}

export class CreateSubscriptionPlanDto {
  @ApiProperty({ example: 'Growth' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiProperty({ example: 'growth' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  slug!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ApiProperty({ example: '999.00', description: 'Monthly reference price in BDT' })
  @Allow()
  monthlyPrice!: string | number;

  @ApiPropertyOptional({
    example: '8991.00',
    description: 'Defaults to monthly × 12 less the yearly discount',
  })
  @IsOptional()
  @Allow()
  yearlyPrice?: string | number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  configuration?: Record<string, unknown>;
}

export class UpdateSubscriptionPlanDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  slug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Allow()
  monthlyPrice?: string | number;

  @ApiPropertyOptional()
  @IsOptional()
  @Allow()
  yearlyPrice?: string | number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  configuration?: Record<string, unknown> | null;
}

export class UpdateSubscriptionPlanStatusDto {
  @ApiProperty()
  @IsBoolean()
  active!: boolean;
}
