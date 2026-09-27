import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { AdminPaginationQueryDto } from './admin-common.dto';

export class ListAdminAuditLogsQueryDto extends AdminPaginationQueryDto {
  @ApiPropertyOptional({ example: 'TENANT_SUSPENDED' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  action?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  storeId?: string;

  @ApiPropertyOptional({ description: 'ISO date lower bound (inclusive)' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'ISO date upper bound (inclusive)' })
  @IsOptional()
  @IsDateString()
  to?: string;
}
