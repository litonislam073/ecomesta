import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsAccountPassword } from './password-policy';

export class RegisterDto {
  @ApiProperty({ example: 'merchant@example.com' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsAccountPassword()
  password!: string;

  @ApiProperty({ example: 'Ada' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  firstName!: string;

  @ApiProperty({ example: 'Lovelace' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  lastName!: string;

  @ApiPropertyOptional({ example: '+15551234567' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  phone?: string;
}
