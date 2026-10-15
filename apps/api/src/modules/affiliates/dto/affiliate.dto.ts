import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ManualPaymentMethod } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsIn, IsInt, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class ApplyAffiliateDto {
  @ApiPropertyOptional({ description: 'How you plan to promote Ecomesta (Facebook page, YouTube, community…)' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  @Transform(trim)
  applicationNote?: string;
}

export class AffiliatePayoutMethodDto {
  @ApiProperty({ enum: ManualPaymentMethod })
  @IsEnum(ManualPaymentMethod)
  method!: ManualPaymentMethod;

  @ApiProperty({ example: '01712345678' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.replace(/[\s-]/g, '').replace(/^\+?88/, '') : value))
  @Matches(/^01[3-9]\d{8}$/, { message: 'Enter an 11-digit mobile number, e.g. 01712345678' })
  number!: string;

  @ApiPropertyOptional({ description: 'Account holder name' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(trim)
  name?: string;
}

export class AffiliateClickDto {
  @ApiProperty({ example: 'RAHIM4821' })
  @IsString()
  @MinLength(3)
  @MaxLength(32)
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  code!: string;
}

export class AdminAffiliateListQueryDto {
  @ApiPropertyOptional({ enum: ['PENDING', 'ACTIVE', 'REJECTED', 'SUSPENDED'] })
  @IsOptional()
  @IsIn(['PENDING', 'ACTIVE', 'REJECTED', 'SUSPENDED'])
  status?: 'PENDING' | 'ACTIVE' | 'REJECTED' | 'SUSPENDED';
}

export class AdminAffiliateReasonDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  @Transform(trim)
  reason!: string;
}

export class AdminAffiliateRateDto {
  @ApiPropertyOptional({ nullable: true, description: 'Percent for this affiliate; null uses the program rate' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  rate?: number | null;
}

export class AdminPayoutPaidDto {
  @ApiProperty({ example: '8N7A6B5C4D' })
  @IsString()
  @MinLength(4)
  @MaxLength(40)
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  transactionId!: string;
}

export class AdminPayoutListQueryDto {
  @ApiPropertyOptional({ enum: ['REQUESTED', 'PAID', 'REJECTED'] })
  @IsOptional()
  @IsIn(['REQUESTED', 'PAID', 'REJECTED'])
  status?: 'REQUESTED' | 'PAID' | 'REJECTED';
}

export class AffiliateSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ description: 'Percent of the first plan payment' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  commissionRate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  cookieDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(90)
  holdDays?: number;

  @ApiPropertyOptional({ description: 'Smallest withdrawal in BDT' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  minPayout?: number;
}
