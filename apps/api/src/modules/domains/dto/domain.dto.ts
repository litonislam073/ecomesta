import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateDomainDto {
  @ApiProperty({
    example: 'shop.example.com',
    description:
      'Custom hostname to attach. Protocol, path and port are stripped server-side.',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(253)
  hostname!: string;
}

export class ResolveDomainQueryDto {
  @ApiPropertyOptional({
    example: 'shop.example.com',
    description: 'Host to resolve; defaults to the request Host header.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(253)
  host?: string;
}
