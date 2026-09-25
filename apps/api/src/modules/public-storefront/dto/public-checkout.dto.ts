import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { PaymentMethod, PaymentProvider } from '@prisma/client';

/** Offline/internal payment options for public checkout (no card gateways). */
export const PUBLIC_CHECKOUT_PROVIDERS = [
  PaymentProvider.COD,
  PaymentProvider.OTHER,
] as const;

export const PUBLIC_CHECKOUT_METHODS = [
  PaymentMethod.CASH,
  PaymentMethod.BANK_TRANSFER,
  PaymentMethod.OTHER,
] as const;

export class PublicCheckoutItemDto {
  @ApiProperty()
  @IsUUID()
  productId!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUUID()
  variantId?: string | null;

  @ApiProperty({ minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  quantity!: number;
}

export class PublicCheckoutAddressDto {
  @ApiProperty({ description: 'Full name' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  addressLine1!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  addressLine2?: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  city!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  state?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  postalCode?: string;

  @ApiProperty({ description: 'ISO 3166-1 alpha-2' })
  @IsString()
  @Matches(/^[A-Za-z]{2}$/)
  country!: string;
}

export class PublicCheckoutCustomerDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @ApiProperty()
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;
}

export class PublicCheckoutDto {
  @ApiProperty({ type: [PublicCheckoutItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PublicCheckoutItemDto)
  items!: PublicCheckoutItemDto[];

  @ApiProperty({ type: PublicCheckoutCustomerDto })
  @ValidateNested()
  @Type(() => PublicCheckoutCustomerDto)
  customer!: PublicCheckoutCustomerDto;

  @ApiProperty({ type: PublicCheckoutAddressDto })
  @ValidateNested()
  @Type(() => PublicCheckoutAddressDto)
  shippingAddress!: PublicCheckoutAddressDto;

  @ApiPropertyOptional({ type: PublicCheckoutAddressDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => PublicCheckoutAddressDto)
  billingAddress?: PublicCheckoutAddressDto;

  @ApiPropertyOptional({
    description: 'When true (default), billing copies shipping',
  })
  @IsOptional()
  @IsBoolean()
  billingSameAsShipping?: boolean;

  @ApiProperty({
    enum: PUBLIC_CHECKOUT_PROVIDERS,
    description: 'COD or OTHER (manual/offline). Gateways not supported in Phase 10.',
  })
  @IsIn(PUBLIC_CHECKOUT_PROVIDERS)
  paymentProvider!: (typeof PUBLIC_CHECKOUT_PROVIDERS)[number];

  @ApiProperty({
    enum: PUBLIC_CHECKOUT_METHODS,
    description: 'CASH, BANK_TRANSFER, or OTHER',
  })
  @IsIn(PUBLIC_CHECKOUT_METHODS)
  paymentMethod!: (typeof PUBLIC_CHECKOUT_METHODS)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  customerNote?: string;
}

export class PublicOrderLookupQueryDto {
  @ApiPropertyOptional({
    description: 'Optional email check against order shipping/billing contact',
  })
  @IsOptional()
  @IsEmail()
  email?: string;
}
