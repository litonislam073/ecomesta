import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { SignupAttributionFieldsDto } from './signup-attribution.dto';

export class GoogleAuthDto extends SignupAttributionFieldsDto {
  @ApiProperty({ description: 'ID token (credential) returned by Google Identity Services' })
  @IsString()
  @MinLength(20)
  @MaxLength(4096)
  credential!: string;

  @ApiPropertyOptional({ description: 'Affiliate referral code from the link the visitor came through' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  referralCode?: string;
}
