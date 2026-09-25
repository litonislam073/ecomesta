import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { SLUG_REGEX, normalizeSlug } from '../../../common/utils/slug.util';

export class CreateTenantDto {
  @ApiProperty({ example: 'Example Business' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  name!: string;

  @ApiProperty({ example: 'example-business' })
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? normalizeSlug(value) : value,
  )
  @Matches(SLUG_REGEX, {
    message: 'slug must be lowercase URL-friendly (a-z, 0-9, hyphens)',
  })
  slug!: string;
}
