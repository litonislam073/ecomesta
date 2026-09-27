import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ShipmentStatus, ShippingProvider } from '@prisma/client';

export class CreateShipmentDto {
  @ApiPropertyOptional({
    enum: ShippingProvider,
    default: ShippingProvider.MANUAL,
  })
  @IsOptional()
  @IsEnum(ShippingProvider)
  provider?: ShippingProvider;

  @ApiPropertyOptional({ enum: ShipmentStatus, default: ShipmentStatus.PENDING })
  @IsOptional()
  @IsEnum(ShipmentStatus)
  status?: ShipmentStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  trackingNumber?: string;
}

export class UpdateShipmentDto {
  @ApiPropertyOptional({ enum: ShipmentStatus })
  @IsOptional()
  @IsEnum(ShipmentStatus)
  status?: ShipmentStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  trackingNumber?: string | null;

  @ApiPropertyOptional({ enum: ShippingProvider })
  @IsOptional()
  @IsEnum(ShippingProvider)
  provider?: ShippingProvider;
}
