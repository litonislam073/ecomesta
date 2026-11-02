import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BillingCycle, SubscriptionStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { AdminPaginationQueryDto } from './admin-common.dto';

/** Empty string or null clears the date; omit leaves it unchanged. */
const optionalClearableDate = ({ value }: { value: unknown }) =>
  value === '' || value === null ? null : value;

export class ListAdminSubscriptionsQueryDto extends AdminPaginationQueryDto {
  @ApiPropertyOptional({ description: 'Partial tenant name/slug or plan name' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  search?: string;

  @ApiPropertyOptional({ enum: SubscriptionStatus })
  @IsOptional()
  @IsIn(Object.values(SubscriptionStatus))
  status?: SubscriptionStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  planId?: string;
}

export class UpdateSubscriptionStatusDto {
  @ApiProperty({ enum: SubscriptionStatus })
  @IsIn(Object.values(SubscriptionStatus))
  status!: SubscriptionStatus;
}

/** Super Admin override of plan and optional paid-through / trial end dates. */
export class UpdateSubscriptionPlanDto {
  @ApiProperty()
  @IsUUID()
  planId!: string;

  @ApiPropertyOptional({
    description: 'Paid-through / period end. Null clears the date.',
    nullable: true,
  })
  @Transform(optionalClearableDate)
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsDateString()
  endsAt?: string | null;

  @ApiPropertyOptional({
    description: 'Trial end. Null clears the date.',
    nullable: true,
  })
  @Transform(optionalClearableDate)
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsDateString()
  trialEndsAt?: string | null;
}

export class CreateSubscriptionDto {
  @ApiProperty()
  @IsUUID()
  tenantId!: string;

  @ApiProperty()
  @IsUUID()
  planId!: string;

  @ApiProperty({ enum: BillingCycle })
  @IsIn(Object.values(BillingCycle))
  billingCycle!: BillingCycle;

  @ApiPropertyOptional({ enum: SubscriptionStatus })
  @IsOptional()
  @IsIn(Object.values(SubscriptionStatus))
  status?: SubscriptionStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startsAt?: string;
}
