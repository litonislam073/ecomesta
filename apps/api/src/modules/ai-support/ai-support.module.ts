import { Module } from '@nestjs/common';
import { AiSupportConversationsService } from './ai-support-conversations.service';
import { AiSupportRetentionScheduler } from './ai-support-retention.scheduler';
import { AiSupportController } from './ai-support.controller';
import { AiSupportKnowledge } from './ai-support.knowledge';
import { AiSupportService } from './ai-support.service';
import { AI_CHAT_CLIENT, OpenAiChatClient } from './openai.client';

/** Platform AI support agent for the Ecomesta website (not merchant storefronts). */
@Module({
  controllers: [AiSupportController],
  providers: [
    AiSupportService,
    AiSupportConversationsService,
    AiSupportRetentionScheduler,
    AiSupportKnowledge,
    OpenAiChatClient,
    { provide: AI_CHAT_CLIENT, useExisting: OpenAiChatClient },
  ],
  exports: [AiSupportConversationsService, AiSupportRetentionScheduler],
})
export class AiSupportModule {}
