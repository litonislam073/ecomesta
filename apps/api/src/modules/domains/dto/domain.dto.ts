import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateDomainDto {
  @ApiProperty({
    example: 'shop.example.com',
    description:
      'Custom hostname to attach. Protocol, path and port are stripped server-side.',
  })
  @IsString({ message: 'Hostname is required' })
  @IsNotEmpty({ message: 'Hostname is required' })
  @MaxLength(253, { message: 'Hostname must be 253 characters or fewer' })
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
