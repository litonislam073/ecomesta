import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export const SUPPORT_CATEGORIES = [
  'Account',
  'Billing',
  'Store setup',
  'Orders',
  'Payments',
  'Shipping',
  'Technical issue',
  'Other',
] as const;

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateSupportRequestDto {
  @ApiProperty({ enum: SUPPORT_CATEGORIES })
  @IsIn(SUPPORT_CATEGORIES)
  category!: (typeof SUPPORT_CATEGORIES)[number];

  @ApiProperty({ minLength: 3, maxLength: 150 })
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(150)
  subject!: string;

  @ApiProperty({ minLength: 10, maxLength: 5000 })
  @Transform(trim)
  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  message!: string;

  @ApiPropertyOptional({ description: 'Store the request is about' })
  @IsOptional()
  @IsUUID()
  storeId?: string;

  @ApiPropertyOptional({ description: 'Client-generated id so a resubmitted form is not sent twice' })
  @IsOptional()
  @IsUUID()
  requestId?: string;
}
