import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class GoogleAuthDto {
  @ApiProperty({ description: 'ID token (credential) returned by Google Identity Services' })
  @IsString()
  @MinLength(20)
  @MaxLength(4096)
  credential!: string;
}
