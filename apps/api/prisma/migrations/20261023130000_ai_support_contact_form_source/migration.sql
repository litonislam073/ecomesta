-- Contact form handoffs share the support-chats inbox with a source label.

CREATE TYPE "AiSupportConversationSource" AS ENUM ('CHAT', 'CONTACT_FORM');

ALTER TABLE "ai_support_conversations"
  ADD COLUMN "source" "AiSupportConversationSource" NOT NULL DEFAULT 'CHAT';

CREATE INDEX "ai_support_conversations_source_idx" ON "ai_support_conversations"("source");
