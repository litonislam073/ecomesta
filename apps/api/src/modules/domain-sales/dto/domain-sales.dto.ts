import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DomainOrderStatus, ManualPaymentMethod } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class DomainSearchQueryDto {
  @ApiProperty({ example: 'amarshop', description: 'A name, or a full domain like amarshop.com' })
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  q!: string;
}

/** The person the domain is registered to (WHOIS): the merchant. */
export class RegistrantDto {
  @ApiProperty() @Transform(trim) @IsString() @MinLength(2) @MaxLength(100) name!: string;
  @ApiProperty() @Transform(trim) @IsEmail() @MaxLength(255) email!: string;
  @ApiProperty({ example: '01712345678' }) @Transform(trim) @IsString() @Matches(/^\+?[\d\s-]{7,20}$/) phone!: string;
  @ApiProperty() @Transform(trim) @IsString() @MinLength(3) @MaxLength(200) address!: string;
  @ApiProperty() @Transform(trim) @IsString() @MinLength(2) @MaxLength(80) city!: string;
  @ApiProperty({ example: '1207' }) @Transform(trim) @IsString() @MinLength(3) @MaxLength(12) postcode!: string;
  @ApiPropertyOptional({ example: 'BD' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @Matches(/^[A-Z]{2}$/)
  country?: string;
}

class WalletPaymentDto {
  @ApiProperty({ enum: ManualPaymentMethod })
  @IsIn(Object.values(ManualPaymentMethod))
  method!: ManualPaymentMethod;

  @ApiProperty({ example: '01712345678' })
  @IsString()
  @MaxLength(20)
  senderNumber!: string;

  @ApiProperty({ example: 'BKA7XY12QZ' })
  @IsString()
  @MaxLength(40)
  transactionId!: string;
}

export class CreateDomainOrderDto extends WalletPaymentDto {
  @ApiProperty({ example: 'amarshop.com' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsString()
  @MaxLength(90)
  domain!: string;

  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  years!: number;

  @ApiProperty({ type: RegistrantDto })
  @ValidateNested()
  @Type(() => RegistrantDto)
  registrant!: RegistrantDto;
}

export class RenewDomainDto extends WalletPaymentDto {
  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  years!: number;
}

export class ListDomainOrdersQueryDto {
  @ApiPropertyOptional({ enum: DomainOrderStatus })
  @IsOptional()
  @IsIn(Object.values(DomainOrderStatus))
  status?: DomainOrderStatus;

  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}

export class RejectDomainOrderDto {
  @ApiProperty({ example: 'No payment with this transaction ID reached our bKash number.' })
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}

export class UpdateDomainSalesSettingsDto {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() enabled?: boolean;
  @ApiPropertyOptional({ example: 125 }) @IsOptional() @IsNumber() @Min(1) @Max(1000) usdRate?: number;
  @ApiPropertyOptional({ example: 250 }) @IsOptional() @IsInt() @Min(0) @Max(100000) marginBdt?: number;
  @ApiPropertyOptional({ example: ['com', 'net', 'shop'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @Matches(/^\.?[a-zA-Z]{2,24}$/, { each: true })
  tlds?: string[];
  @ApiPropertyOptional({ example: 5 }) @IsOptional() @IsInt() @Min(1) @Max(10) maxYears?: number;
}
