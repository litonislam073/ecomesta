import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PlatformRole, UserStatus } from '@prisma/client';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { AdminPaginationQueryDto, SORT_ORDERS, type SortOrder } from './admin-common.dto';

/** Statuses a Super Admin may set directly; lifecycle states stay system-owned. */
export const ADMIN_USER_STATUSES = [
  UserStatus.ACTIVE,
  UserStatus.SUSPENDED,
] as const;

export const ADMIN_USER_SORT_FIELDS = ['createdAt', 'email'] as const;

export class ListAdminUsersQueryDto extends AdminPaginationQueryDto {
  @ApiPropertyOptional({ description: 'Partial email match' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  search?: string;

  @ApiPropertyOptional({ enum: UserStatus })
  @IsOptional()
  @IsIn(Object.values(UserStatus))
  status?: UserStatus;

  @ApiPropertyOptional({ enum: PlatformRole })
  @IsOptional()
  @IsIn(Object.values(PlatformRole))
  platformRole?: PlatformRole;

  @ApiPropertyOptional({ enum: ADMIN_USER_SORT_FIELDS })
  @IsOptional()
  @IsIn(ADMIN_USER_SORT_FIELDS)
  sort?: (typeof ADMIN_USER_SORT_FIELDS)[number];

  @ApiPropertyOptional({ enum: SORT_ORDERS })
  @IsOptional()
  @IsIn(SORT_ORDERS)
  order?: SortOrder;
}

export class UpdateUserStatusDto {
  @ApiProperty({ enum: ADMIN_USER_STATUSES })
  @IsIn(ADMIN_USER_STATUSES)
  status!: (typeof ADMIN_USER_STATUSES)[number];
}

export class UpdateUserPlatformRoleDto {
  @ApiProperty({ enum: PlatformRole })
  @IsIn(Object.values(PlatformRole))
  platformRole!: PlatformRole;
}
