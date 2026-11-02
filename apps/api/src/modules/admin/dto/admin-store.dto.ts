import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StoreStatus } from '@prisma/client';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
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

  @ApiPropertyOptional({ enum: ['live', 'deleted'], description: 'Live stores or soft-deleted ones (default: both)' })
  @IsOptional()
  @IsIn(['live', 'deleted'])
  deleted?: 'live' | 'deleted';
}

export class UpdateStoreStatusDto {
  @ApiProperty({ enum: ADMIN_STORE_STATUSES })
  @IsIn(ADMIN_STORE_STATUSES)
  status!: (typeof ADMIN_STORE_STATUSES)[number];
}

export class SoftDeleteStoreDto {
  @ApiPropertyOptional({ description: 'Why the store is removed (kept in the audit log)' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class RestoreStoreDto {
  @ApiPropertyOptional({ description: 'New address when the old one is taken' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  slug?: string;
}

export class PermanentDeleteStoreDto {
  @ApiProperty({ description: 'The store address, typed to confirm' })
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  confirmSlug!: string;
}
