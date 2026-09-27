import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TenantStatus } from '@prisma/client';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { AdminPaginationQueryDto } from './admin-common.dto';

export const ADMIN_TENANT_STATUSES = [
  TenantStatus.ACTIVE,
  TenantStatus.SUSPENDED,
] as const;

export class ListAdminTenantsQueryDto extends AdminPaginationQueryDto {
  @ApiPropertyOptional({ description: 'Partial name or slug match' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  search?: string;

  @ApiPropertyOptional({ enum: TenantStatus })
  @IsOptional()
  @IsIn(Object.values(TenantStatus))
  status?: TenantStatus;
}

export class UpdateTenantStatusDto {
  @ApiProperty({ enum: ADMIN_TENANT_STATUSES })
  @IsIn(ADMIN_TENANT_STATUSES)
  status!: (typeof ADMIN_TENANT_STATUSES)[number];
}
