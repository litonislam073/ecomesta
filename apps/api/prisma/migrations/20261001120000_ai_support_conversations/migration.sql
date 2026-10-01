-- Website support chat history: visitor details (name and phone required,
-- email optional) and every message, readable by Super Admins.
-- Additive: two new tables and one enum.

-- CreateEnum
CREATE TYPE "AiSupportMessageRole" AS ENUM ('USER', 'ASSISTANT');

-- CreateTable
CREATE TABLE "ai_support_conversations" (
    "id" UUID NOT NULL,
    "visitor_name" TEXT NOT NULL,
    "visitor_phone" TEXT NOT NULL,
    "visitor_email" CITEXT,
    "token_hash" TEXT NOT NULL,
    "user_agent" TEXT,
    "message_count" INTEGER NOT NULL DEFAULT 0,
    "last_message_at" TIMESTAMP(3),
    "handoff_reference" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_support_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_support_messages" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "role" "AiSupportMessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "handoff_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_support_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_support_conversations_created_at_idx" ON "ai_support_conversations"("created_at");

-- CreateIndex
CREATE INDEX "ai_support_conversations_visitor_phone_idx" ON "ai_support_conversations"("visitor_phone");

-- CreateIndex
CREATE INDEX "ai_support_messages_conversation_id_created_at_idx" ON "ai_support_messages"("conversation_id", "created_at");

-- AddForeignKey
ALTER TABLE "ai_support_messages" ADD CONSTRAINT "ai_support_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "ai_support_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

