import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BillingPaymentStatus, ManualPaymentMethod } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

/** Buying a premium theme by mobile wallet: the amount comes from the theme, never the client. */
export class PurchaseThemeDto {
  @ApiProperty({ enum: ManualPaymentMethod })
  @IsIn(Object.values(ManualPaymentMethod))
  method!: ManualPaymentMethod;

  @ApiProperty({ example: '01712345678', description: 'Wallet number the merchant paid from' })
  @IsString()
  @MaxLength(20)
  senderNumber!: string;

  @ApiProperty({ example: 'BKA7XY12QZ', description: 'Transaction ID from the wallet payment message' })
  @IsString()
  @MaxLength(40)
  transactionId!: string;
}

export class ListThemePurchasesQueryDto {
  @ApiPropertyOptional({ enum: BillingPaymentStatus })
  @IsOptional()
  @IsIn(Object.values(BillingPaymentStatus))
  status?: BillingPaymentStatus;

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
}

export class RejectThemePurchaseDto {
  @ApiProperty({ example: 'No payment with this transaction ID reached our bKash number.' })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}
