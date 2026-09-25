import {
  Allow,
  ArrayMinSize,
  IsArray,
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
import {
  FulfillmentStatus,
  OrderStatus,
  PaymentMethod,
  PaymentProvider,
  PaymentStatus,
} from '@prisma/client';

export class OrderItemInputDto {
  @ApiProperty()
  @IsUUID()
  productId!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUUID()
  variantId?: string | null;

  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  quantity!: number;
}

export class OrderAddressInputDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @ApiPropertyOptional({ description: 'Full name; split into first/last when firstName omitted' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  company?: string;

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
}

export class CreateOrderDto {
  @ApiPropertyOptional({ description: 'Existing same-store customer; omit for guest' })
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiPropertyOptional({ description: 'Copy shipping from this same-store customer address' })
  @IsOptional()
  @IsUUID()
  shippingAddressId?: string;

  @ApiPropertyOptional({ description: 'Copy billing from this same-store customer address' })
  @IsOptional()
  @IsUUID()
  billingAddressId?: string;

  @ApiProperty({ type: [OrderItemInputDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderItemInputDto)
  items!: OrderItemInputDto[];

  @ApiPropertyOptional({ type: OrderAddressInputDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => OrderAddressInputDto)
  shippingAddress?: OrderAddressInputDto;

  @ApiPropertyOptional({ type: OrderAddressInputDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => OrderAddressInputDto)
  billingAddress?: OrderAddressInputDto;

  @ApiPropertyOptional({ description: 'Non-negative decimal string/number' })
  @IsOptional()
  @Allow()
  discountTotal?: string | number;

  @ApiPropertyOptional({ description: 'Non-negative decimal string/number' })
  @IsOptional()
  @Allow()
  shippingTotal?: string | number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  customerNote?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  internalNote?: string;

  @ApiPropertyOptional({ enum: PaymentProvider, default: PaymentProvider.COD })
  @IsOptional()
  @IsIn(Object.values(PaymentProvider))
  paymentProvider?: PaymentProvider;

  @ApiPropertyOptional({ enum: PaymentMethod, default: PaymentMethod.CASH })
  @IsOptional()
  @IsIn(Object.values(PaymentMethod))
  paymentMethod?: PaymentMethod;

  @ApiPropertyOptional({
    enum: [PaymentStatus.PENDING, PaymentStatus.PAID],
    description: 'Only PENDING or PAID allowed at creation (internal/COD foundation)',
  })
  @IsOptional()
  @IsIn([PaymentStatus.PENDING, PaymentStatus.PAID])
  paymentStatus?: PaymentStatus;
}

export class UpdateOrderStatusDto {
  @ApiProperty({ enum: OrderStatus })
  @IsIn(Object.values(OrderStatus))
  status!: OrderStatus;
}

export class UpdatePaymentStatusDto {
  @ApiProperty({ enum: PaymentStatus })
  @IsIn(Object.values(PaymentStatus))
  paymentStatus!: PaymentStatus;
}

export class UpdateFulfillmentStatusDto {
  @ApiProperty({ enum: FulfillmentStatus })
  @IsIn(Object.values(FulfillmentStatus))
  fulfillmentStatus!: FulfillmentStatus;
}

export class ListOrdersQueryDto {
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

  @ApiPropertyOptional({ enum: OrderStatus })
  @IsOptional()
  @IsIn(Object.values(OrderStatus))
  status?: OrderStatus;

  @ApiPropertyOptional({ enum: PaymentStatus })
  @IsOptional()
  @IsIn(Object.values(PaymentStatus))
  paymentStatus?: PaymentStatus;

  @ApiPropertyOptional({ enum: FulfillmentStatus })
  @IsOptional()
  @IsIn(Object.values(FulfillmentStatus))
  fulfillmentStatus?: FulfillmentStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiPropertyOptional({ description: 'ISO date/datetime inclusive start' })
  @IsOptional()
  @IsString()
  createdFrom?: string;

  @ApiPropertyOptional({ description: 'ISO date/datetime inclusive end' })
  @IsOptional()
  @IsString()
  createdTo?: string;

  @ApiPropertyOptional({ enum: ['createdAt', 'updatedAt', 'grandTotal', 'orderNumber'] })
  @IsOptional()
  @IsIn(['createdAt', 'updatedAt', 'grandTotal', 'orderNumber'])
  sortBy?: 'createdAt' | 'updatedAt' | 'grandTotal' | 'orderNumber';

  @ApiPropertyOptional({ enum: ['asc', 'desc'] })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';
}
