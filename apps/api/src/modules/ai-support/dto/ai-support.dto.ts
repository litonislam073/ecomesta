import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
/** Spaces, dashes and brackets are formatting only: "01711-000 000" is stored as "01711000000". */
const phoneDigits = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.replace(/[\s\-().]/g, '') : value);
/** An empty email means "not given". */
const optionalTrim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() || undefined : value);

export class ChatTurnDto {
  @ApiProperty({ enum: ['user', 'assistant'] })
  @IsIn(['user', 'assistant'])
  role!: 'user' | 'assistant';

  /** Hard ceiling; the service applies the per-role limits and the history budget. */
  @ApiProperty({ maxLength: 4000 })
  @IsString()
  @MaxLength(4000)
  content!: string;
}

/** Name and phone are required before a chat starts; email is optional. */
export class StartAiSupportChatDto {
  @ApiProperty({ minLength: 2, maxLength: 100 })
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: '01711000000' })
  @Transform(phoneDigits)
  @IsString()
  @Matches(/^\+?\d{6,15}$/, { message: 'phone must be a valid phone number' })
  phone!: string;

  @ApiPropertyOptional({ maxLength: 200 })
  @Transform(optionalTrim)
  @IsOptional()
  @IsEmail()
  @MaxLength(200)
  email?: string;

  /** Honeypot: hidden from people, so only bots fill it in. */
  @ApiPropertyOptional({ description: 'Leave empty' })
  @IsOptional()
  @IsString()
  @MaxLength(0, { message: 'Invalid request' })
  website?: string;
}

/** The chat a message belongs to, with the secret returned when it was started. */
class ConversationCredentialsDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  conversationId!: string;

  @ApiProperty()
  @IsString()
  @Length(16, 100)
  conversationToken!: string;
}

export class AiSupportChatDto extends ConversationCredentialsDto {
  @ApiProperty({ type: [ChatTurnDto], description: 'Conversation so far, oldest first; the last turn is the new user message.' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => ChatTurnDto)
  messages!: ChatTurnDto[];
}

export class AiSupportHandoffDto {
  /** Links the request to the chat it came from, when given. */
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  conversationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(16, 100)
  conversationToken?: string;

  @ApiProperty({ minLength: 2, maxLength: 100 })
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: '01711000000', description: 'Required: the team can always call or message the visitor back.' })
  @Transform(phoneDigits)
  @IsString()
  @Matches(/^\+?\d{6,15}$/, { message: 'phone must be a valid phone number' })
  phone!: string;

  @ApiPropertyOptional({ maxLength: 200 })
  @Transform(optionalTrim)
  @IsOptional()
  @IsEmail()
  @MaxLength(200)
  email?: string;

  @ApiProperty({ minLength: 10, maxLength: 2000 })
  @Transform(trim)
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  message!: string;

  @ApiPropertyOptional({ maxLength: 200, description: 'Topic suggested by the AI agent' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;

  @ApiPropertyOptional({ type: [ChatTurnDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => ChatTurnDto)
  transcript?: ChatTurnDto[];

  /** Honeypot: hidden from people, so only bots fill it in. */
  @ApiPropertyOptional({ description: 'Leave empty' })
  @IsOptional()
  @IsString()
  @MaxLength(0, { message: 'Invalid request' })
  website?: string;
}

export class ListAiSupportConversationsQueryDto {
  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ description: 'Name, phone, email or support reference' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;
}
