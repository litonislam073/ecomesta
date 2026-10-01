import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AiSupportChatDto, AiSupportHandoffDto, StartAiSupportChatDto } from './dto/ai-support.dto';
import { AiSupportConversationsService } from './ai-support-conversations.service';
import { AiSupportService } from './ai-support.service';

/**
 * Ecomesta's platform-level AI support agent for the marketing website.
 * Anonymous, rate limited, and never given access to any store's data.
 * Conversations are saved for Super Admins to read.
 */
@ApiTags('ai-support')
@Controller({ path: 'ai-support', version: '1' })
export class AiSupportController {
  constructor(
    private readonly aiSupport: AiSupportService,
    private readonly conversations: AiSupportConversationsService,
  ) {}

  @Post('conversations')
  @HttpCode(201)
  @ApiOperation({ summary: 'Start a support chat with the visitor’s name and phone (email optional)' })
  async start(@Body() dto: StartAiSupportChatDto, @Req() req: Request) {
    return { success: true as const, data: await this.conversations.start(dto, req) };
  }

  @Post('chat')
  @HttpCode(200)
  @ApiOperation({ summary: 'Ask the Ecomesta AI support agent (anonymous, rate limited)' })
  async chat(@Body() dto: AiSupportChatDto, @Req() req: Request) {
    // Checked before any model call: messages only go to a chat the visitor started.
    await this.conversations.authorize(dto);
    const reply = await this.aiSupport.chat(dto.messages, req);
    await this.conversations.recordExchange(dto.conversationId, {
      question: dto.messages.at(-1)!.content,
      reply: reply.reply,
      handoffReason: reply.handoff?.reason ?? null,
    });
    return { success: true as const, data: reply };
  }

  @Post('handoff')
  @HttpCode(200)
  @ApiOperation({ summary: 'Send a website visitor’s request to the Ecomesta support team' })
  async handoff(@Body() dto: AiSupportHandoffDto, @Req() req: Request) {
    const result = await this.aiSupport.handoff(dto, req);
    if (dto.conversationId && dto.conversationToken) {
      const credentials = { conversationId: dto.conversationId, conversationToken: dto.conversationToken };
      // The request is already on its way to the team; a stale chat only means it is not linked.
      const linked = await this.conversations.authorize(credentials).then(
        () => true,
        () => false,
      );
      if (linked) await this.conversations.linkHandoff(dto.conversationId, result.reference);
    }
    return { success: true as const, data: result };
  }
}
