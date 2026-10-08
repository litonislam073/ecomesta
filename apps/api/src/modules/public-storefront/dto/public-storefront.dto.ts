import {
  ArrayMaxSize,
  IsArray,
  IsUUID,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';

export class ListPublicProductsQueryDto {
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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  categorySlug?: string;

  @ApiPropertyOptional({ description: 'Minimum base/variant price' })
  @IsOptional()
  @IsString()
  minPrice?: string;

  @ApiPropertyOptional({ description: 'Maximum base/variant price' })
  @IsOptional()
  @IsString()
  maxPrice?: string;

  @ApiPropertyOptional({
    enum: ['createdAt', 'name', 'basePrice', 'updatedAt'],
  })
  @IsOptional()
  @IsIn(['createdAt', 'name', 'basePrice', 'updatedAt'])
  sortBy?: 'createdAt' | 'name' | 'basePrice' | 'updatedAt';

  @ApiPropertyOptional({ enum: ['asc', 'desc'] })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';

  @ApiPropertyOptional({
    description: 'When true, only products that are currently available',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => value === true || value === 'true')
  inStock?: boolean;

  @ApiPropertyOptional({
    description: 'Only these products (comma-separated ids, at most 24), e.g. the theme deal of the day',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.split(',').map((id) => id.trim()).filter(Boolean) : value,
  )
  @IsArray()
  @ArrayMaxSize(24)
  @IsUUID('all', { each: true })
  ids?: string[];
}

export class ListPublicCategoriesQueryDto {
  @ApiPropertyOptional({ description: 'Return nested tree when true' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => value === true || value === 'true')
  tree?: boolean;
}
