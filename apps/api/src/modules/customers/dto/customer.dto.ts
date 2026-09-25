import {
  IsEmail,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { CustomerAddressType } from '@prisma/client';

const PHONE_REGEX = /^\+?[0-9()\-\s.]{7,20}$/;
const COUNTRY_REGEX = /^[A-Z]{2}$/;

function trimString({ value }: { value: unknown }) {
  return typeof value === 'string' ? value.trim() : value;
}

function normalizeEmail({ value }: { value: unknown }) {
  return typeof value === 'string' ? value.trim().toLowerCase() : value;
}

function normalizeCountry({ value }: { value: unknown }) {
  return typeof value === 'string' ? value.trim().toUpperCase() : value;
}

export class CreateCustomerDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(normalizeEmail)
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @Matches(PHONE_REGEX, {
    message: 'phone must be a valid international phone number',
  })
  phone?: string;

  @ApiProperty()
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  firstName!: string;

  @ApiProperty()
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  lastName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class UpdateCustomerDto {
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Transform(normalizeEmail)
  @IsEmail()
  @MaxLength(255)
  email?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Transform(trimString)
  @IsString()
  @Matches(PHONE_REGEX, {
    message: 'phone must be a valid international phone number',
  })
  phone?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  lastName?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Transform(trimString)
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
}

export class ListCustomersQueryDto {
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
  @Transform(normalizeEmail)
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(32)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  createdFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  createdTo?: string;

  @ApiPropertyOptional({ enum: ['createdAt', 'updatedAt', 'firstName', 'lastName', 'email'] })
  @IsOptional()
  @IsIn(['createdAt', 'updatedAt', 'firstName', 'lastName', 'email'])
  sortBy?: 'createdAt' | 'updatedAt' | 'firstName' | 'lastName' | 'email';

  @ApiPropertyOptional({ enum: ['asc', 'desc'] })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';
}

export class CreateCustomerAddressDto {
  @ApiProperty({ enum: CustomerAddressType })
  @IsIn(Object.values(CustomerAddressType))
  type!: CustomerAddressType;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(120)
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(120)
  lastName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(120)
  company?: string;

  @ApiProperty()
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  addressLine1!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(255)
  addressLine2?: string;

  @ApiProperty()
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  city!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(120)
  state?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(32)
  postalCode?: string;

  @ApiProperty({ example: 'BD', description: 'ISO 3166-1 alpha-2 country code' })
  @Transform(normalizeCountry)
  @IsString()
  @Matches(COUNTRY_REGEX)
  country!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @Matches(PHONE_REGEX, {
    message: 'phone must be a valid international phone number',
  })
  phone?: string;
}

export class UpdateCustomerAddressDto {
  @ApiPropertyOptional({ enum: CustomerAddressType })
  @IsOptional()
  @IsIn(Object.values(CustomerAddressType))
  type?: CustomerAddressType;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Transform(trimString)
  @IsString()
  @MaxLength(120)
  firstName?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Transform(trimString)
  @IsString()
  @MaxLength(120)
  lastName?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Transform(trimString)
  @IsString()
  @MaxLength(120)
  company?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  addressLine1?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Transform(trimString)
  @IsString()
  @MaxLength(255)
  addressLine2?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  city?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Transform(trimString)
  @IsString()
  @MaxLength(120)
  state?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Transform(trimString)
  @IsString()
  @MaxLength(32)
  postalCode?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(normalizeCountry)
  @IsString()
  @Matches(COUNTRY_REGEX)
  country?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Transform(trimString)
  @IsString()
  @Matches(PHONE_REGEX, {
    message: 'phone must be a valid international phone number',
  })
  phone?: string | null;
}
