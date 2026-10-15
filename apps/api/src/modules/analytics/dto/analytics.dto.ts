import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StoreAnalyticsEventType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class AnalyticsRangeQueryDto {
  @ApiPropertyOptional({ example: '2026-10-01', description: 'First day, in the store’s time zone (default: 30 days ago)' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Use a date like 2026-10-01' })
  from?: string;

  @ApiPropertyOptional({ example: '2026-10-15', description: 'Last day, inclusive (default: today)' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Use a date like 2026-10-15' })
  to?: string;
}

/** Sent by the storefront; everything is checked and trimmed again on the server. */
export class AnalyticsEventDto {
  @ApiProperty({ enum: StoreAnalyticsEventType })
  @IsEnum(StoreAnalyticsEventType)
  type!: StoreAnalyticsEventType;

  @ApiProperty({ example: '/products/red-saree' })
  @IsString()
  @MaxLength(2000)
  path!: string;

  @ApiPropertyOptional({ description: 'Product on a product view or add to cart' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  productId?: string;

  @ApiPropertyOptional({ description: 'Where the visit started: utm_source or the referring website host' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  source?: string;
}
