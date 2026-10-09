import { ApiPropertyOptional } from '@nestjs/swagger';
import { ShippingProvider } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsObject, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

/** Connect or update a courier. Keys are write-only; omit them to keep the saved ones. */
export class UpsertCourierConnectionDto {
  @ApiPropertyOptional({
    description: "The courier's connection fields by key (see `fields` on the courier). Secret values are write-only; omit a key to keep its saved value.",
    type: 'object',
    additionalProperties: { type: 'string' },
  })
  @IsOptional()
  @IsObject()
  credentials?: Record<string, string>;

  @ApiPropertyOptional({ description: 'Courier API key (write-only, never returned)' })
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(200)
  @Matches(/^\S+$/, { message: 'apiKey must not contain spaces' })
  apiKey?: string;

  @ApiPropertyOptional({ description: 'Courier secret key (write-only, never returned)' })
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(200)
  @Matches(/^\S+$/, { message: 'secretKey must not contain spaces' })
  secretKey?: string;

  @ApiPropertyOptional({ description: 'Pickup contact name (for your team; Steadfast uses its own pickup settings)' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  pickupName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  pickupPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(250)
  pickupAddress?: string;

  @ApiPropertyOptional({ description: 'Default parcel weight in kg' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.01)
  @Max(100)
  defaultWeightKg?: number;
}

/** Book a courier parcel for an order. The COD amount is always computed server-side. */
export class CreateCourierShipmentDto {
  @ApiPropertyOptional({ enum: ShippingProvider })
  @IsEnum(ShippingProvider)
  provider!: ShippingProvider;

  @ApiPropertyOptional({ description: 'Parcel weight in kg (kept on the shipment)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.01)
  @Max(100)
  weightKg?: number;

  @ApiPropertyOptional({ description: 'Note for the courier' })
  @IsOptional()
  @IsString()
  @MaxLength(250)
  note?: string;

  @ApiPropertyOptional({
    description: "Values picked for the courier's location steps (e.g. RedX area, eCourier city/thana/post code/area)",
    type: 'object',
    additionalProperties: { type: 'string' },
  })
  @IsOptional()
  @IsObject()
  location?: Record<string, string>;
}

/** Choices for one courier location step, given the values picked in earlier steps. */
export class CourierLocationOptionsDto {
  @ApiPropertyOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  step!: string;

  @ApiPropertyOptional({ type: 'object', additionalProperties: { type: 'string' } })
  @IsOptional()
  @IsObject()
  picked?: Record<string, string>;
}
