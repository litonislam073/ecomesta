import {
  ArrayMaxSize,
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
  PaymentProvider.TEST,
  PaymentProvider.STRIPE,
  PaymentProvider.SSL_COMMERZ,
] as const;

export const PUBLIC_CHECKOUT_METHODS = [
  PaymentMethod.CASH,
  PaymentMethod.BANK_TRANSFER,
  PaymentMethod.OTHER,
  PaymentMethod.CARD,
] as const;

const MONEY_PATTERN = /^\d{1,10}(\.\d{1,2})?$/;

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

  @ApiPropertyOptional({ description: 'Bangladesh division UUID' })
  @IsOptional()
  @IsUUID()
  divisionId?: string;

  @ApiPropertyOptional({ description: 'Bangladesh district UUID' })
  @IsOptional()
  @IsUUID()
  districtId?: string;

  @ApiPropertyOptional({ description: 'Bangladesh upazila UUID' })
  @IsOptional()
  @IsUUID()
  upazilaId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  landmark?: string;
}

export class PublicCheckoutCustomerDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional({ description: 'Optional; the phone number is the required contact' })
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

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
    description: 'Active store shipping method selected at checkout',
  })
  @IsUUID()
  shippingMethodId!: string;

  @ApiProperty({
    enum: PUBLIC_CHECKOUT_PROVIDERS,
    description: 'COD or OTHER (manual/offline). Gateways not supported.',
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

  @ApiPropertyOptional({
    description: 'Optional store coupon code; server validates and computes discount',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  couponCode?: string;

  @ApiPropertyOptional({
    description:
      'Grand total from POST /checkout/quote that the customer confirmed. Never used as a price; when it differs from the server total the order is refused with 409 CHECKOUT_TOTAL_CHANGED.',
    example: '1260.00',
  })
  @IsOptional()
  @IsString()
  @Matches(MONEY_PATTERN, { message: 'expectedTotal must be an amount with up to 2 decimals' })
  expectedTotal?: string;
}

/** Cart + checkout inputs for a display-only, server-priced checkout summary. */
export class PublicCheckoutQuoteDto {
  @ApiProperty({ type: [PublicCheckoutItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => PublicCheckoutItemDto)
  items!: PublicCheckoutItemDto[];

  @ApiPropertyOptional({ description: 'Bangladesh division UUID' })
  @IsOptional()
  @IsUUID()
  divisionId?: string;

  @ApiPropertyOptional({ description: 'Bangladesh district UUID' })
  @IsOptional()
  @IsUUID()
  districtId?: string;

  @ApiPropertyOptional({ description: 'Bangladesh upazila UUID' })
  @IsOptional()
  @IsUUID()
  upazilaId?: string;

  @ApiPropertyOptional({ description: 'Selected shipping method; defaults to the first available' })
  @IsOptional()
  @IsUUID()
  shippingMethodId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  couponCode?: string;

  @ApiPropertyOptional({ description: 'Checkout email, for per-customer coupon limits' })
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;
}

export class CancelPublicOrderDto {
  @ApiPropertyOptional({ description: 'Checkout email (email and/or phone required)' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: 'Checkout phone (email and/or phone required)' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @ApiPropertyOptional({ description: 'Optional reason shown to the store', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class PublicOrderLookupQueryDto {
  @ApiPropertyOptional({
    description:
      'Email check against order shipping/billing contact. Provide email and/or phone (required). Wrong → 404 (no enumeration).',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    description:
      'Phone check against order shipping/billing contact. Provide email and/or phone (required). Wrong → 404.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;
}
