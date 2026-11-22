import { ApiPropertyOptional } from '@nestjs/swagger';
import { EmailDeliveryStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { AdminPaginationQueryDto } from '../../admin/dto/admin-common.dto';

export class ListEmailDeliveriesQueryDto extends AdminPaginationQueryDto {
  @ApiPropertyOptional({ enum: EmailDeliveryStatus })
  @IsOptional()
  @IsEnum(EmailDeliveryStatus)
  status?: EmailDeliveryStatus;

  @ApiPropertyOptional({ description: 'Partial match on event type' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  eventType?: string;
}
