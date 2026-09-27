import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StoreStatus } from '@prisma/client';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { AdminPaginationQueryDto } from './admin-common.dto';

export const ADMIN_STORE_STATUSES = [
  StoreStatus.ACTIVE,
  StoreStatus.SUSPENDED,
] as const;

export class ListAdminStoresQueryDto extends AdminPaginationQueryDto {
  @ApiPropertyOptional({ description: 'Partial name or slug match' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  search?: string;

  @ApiPropertyOptional({ enum: StoreStatus })
  @IsOptional()
  @IsIn(Object.values(StoreStatus))
  status?: StoreStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  tenantId?: string;
}

export class UpdateStoreStatusDto {
  @ApiProperty({ enum: ADMIN_STORE_STATUSES })
  @IsIn(ADMIN_STORE_STATUSES)
  status!: (typeof ADMIN_STORE_STATUSES)[number];
}
