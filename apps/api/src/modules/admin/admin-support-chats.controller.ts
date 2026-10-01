import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AiSupportConversationsService } from '../ai-support/ai-support-conversations.service';
import { ListAiSupportConversationsQueryDto } from '../ai-support/dto/ai-support.dto';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('SUPER_ADMIN')
@Controller({ path: 'admin/support-chats', version: '1' })
export class AdminSupportChatsController {
  constructor(private readonly conversations: AiSupportConversationsService) {}

  @Get()
  @ApiOperation({ summary: 'Website support chats, newest first' })
  async list(@Query() query: ListAiSupportConversationsQueryDto) {
    return { success: true as const, data: await this.conversations.adminList(query) };
  }

  @Get(':conversationId')
  @ApiOperation({ summary: 'One website support chat with every message' })
  async get(@Param('conversationId', ParseUUIDPipe) conversationId: string) {
    return { success: true as const, data: await this.conversations.adminGet(conversationId) };
  }
}
