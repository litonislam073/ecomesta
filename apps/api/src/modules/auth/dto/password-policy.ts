import { applyDecorators } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
export const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).+$/;

/** The account password policy, shared by registration and password reset. */
export function IsAccountPassword(): PropertyDecorator {
  return applyDecorators(
    ApiProperty({ minLength: PASSWORD_MIN_LENGTH, maxLength: PASSWORD_MAX_LENGTH }),
    IsString(),
    MinLength(PASSWORD_MIN_LENGTH),
    MaxLength(PASSWORD_MAX_LENGTH),
    Matches(PASSWORD_PATTERN, {
      message: 'password must contain at least one letter and one number',
    }),
  );
}
