import {
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentProvider } from '@prisma/client';

export class UpsertPaymentProviderConfigDto {
  @ApiProperty({ enum: PaymentProvider })
  @IsIn([
    PaymentProvider.TEST,
    PaymentProvider.STRIPE,
    PaymentProvider.SSL_COMMERZ,
  ])
  provider!: PaymentProvider;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ enum: ['test', 'live'], default: 'test' })
  @IsOptional()
  @IsIn(['test', 'live'])
  mode?: 'test' | 'live';

  @ApiPropertyOptional({
    description: 'Non-secret public configuration (safe to return)',
  })
  @IsOptional()
  @IsObject()
  publicConfig?: Record<string, unknown>;

  @ApiPropertyOptional({
    description:
      'Secret configuration (encrypted at rest; never returned). TEST: { webhookSecret }. STRIPE: { secretKey, webhookSecret }. SSL_COMMERZ: { storeId, storePassword }',
  })
  @IsOptional()
  @IsObject()
  secrets?: Record<string, unknown>;
}

export class UpdatePaymentProviderConfigDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ enum: ['test', 'live'] })
  @IsOptional()
  @IsIn(['test', 'live'])
  mode?: 'test' | 'live';

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  publicConfig?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Replace secrets when provided; omit to keep existing',
  })
  @IsOptional()
  @IsObject()
  secrets?: Record<string, unknown>;
}

export class InitiatePublicPaymentDto {
  @ApiProperty({ description: 'Opaque public order reference' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  publicReference!: string;

  @ApiProperty({ enum: PaymentProvider })
  @IsIn([
    PaymentProvider.TEST,
    PaymentProvider.STRIPE,
    PaymentProvider.SSL_COMMERZ,
  ])
  provider!: PaymentProvider;

  @ApiPropertyOptional({
    description:
      'Email check against order addresses. Provide email and/or phone (required). Wrong → 404.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  email?: string;

  @ApiPropertyOptional({
    description:
      'Phone check against order addresses. Provide email and/or phone (required). Wrong → 404.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;
}

export class RetryPublicPaymentDto {
  @ApiProperty()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  publicReference!: string;

  @ApiProperty({ enum: PaymentProvider })
  @IsIn([
    PaymentProvider.TEST,
    PaymentProvider.STRIPE,
    PaymentProvider.SSL_COMMERZ,
  ])
  provider!: PaymentProvider;

  @ApiPropertyOptional({
    description: 'Email and/or phone required for contact proof',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;
}
