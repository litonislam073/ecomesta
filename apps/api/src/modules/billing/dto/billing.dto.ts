import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BillingCycle } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { SLUG_REGEX, normalizeSlug } from '../../../common/utils/slug.util';

const toSlug = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? normalizeSlug(value) : value;

export class BillingTenantQueryDto {
  @ApiPropertyOptional({ description: 'Tenant slug; defaults to your first business account' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  @Transform(toSlug)
  @Matches(SLUG_REGEX)
  tenant?: string;
}

export class SelectPlanDto extends BillingTenantQueryDto {
  @ApiProperty({ example: 'growth' })
  @IsString()
  @MaxLength(120)
  @Transform(toSlug)
  @Matches(SLUG_REGEX)
  planSlug!: string;

  @ApiProperty({ enum: BillingCycle })
  @IsIn(Object.values(BillingCycle))
  billingCycle!: BillingCycle;
}
