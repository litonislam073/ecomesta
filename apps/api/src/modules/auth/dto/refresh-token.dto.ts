import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class RefreshTokenDto {
  @ApiPropertyOptional({
    description: 'Optional when refresh token is sent via HttpOnly cookie',
  })
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
