import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { AUTH_TOKEN_PATTERN } from '../../auth-tokens/auth-token.service';
import { IsAccountPassword } from './password-policy';

const TOKEN_MESSAGE = 'token is invalid';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'merchant@example.com' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(255)
  email!: string;
}

export class EmailTokenDto {
  @ApiProperty({ description: 'Token from the emailed link' })
  @IsString()
  @Matches(AUTH_TOKEN_PATTERN, { message: TOKEN_MESSAGE })
  token!: string;
}

export class ResetPasswordDto extends EmailTokenDto {
  @IsAccountPassword()
  password!: string;
}

export class RequestEmailChangeDto {
  @ApiProperty({ example: 'new-address@example.com', description: 'The address to switch to' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @ApiProperty({ description: 'Current password, to prove it is the account owner' })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  currentPassword!: string;
}
