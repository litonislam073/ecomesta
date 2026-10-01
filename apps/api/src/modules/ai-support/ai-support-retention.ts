import type { Prisma, PrismaClient } from '@prisma/client';

/**
 * Website support chats are kept for this long after their last activity
 * (the last message, or the start for a chat with no messages). Change it with
 * AI_SUPPORT_RETENTION_DAYS.
 */
export const DEFAULT_AI_SUPPORT_RETENTION_DAYS = 365;
export const MAX_AI_SUPPORT_RETENTION_DAYS = 3650;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days between 1 and 3650; anything missing or invalid falls back to the default. */
export function retentionDays(raw: unknown): number {
  if (raw === undefined || raw === null || (typeof raw === 'string' && raw.trim() === '')) {
    return DEFAULT_AI_SUPPORT_RETENTION_DAYS;
  }
  const value = typeof raw === 'number' ? raw : Number(raw);
  return Number.isInteger(value) && value >= 1 && value <= MAX_AI_SUPPORT_RETENTION_DAYS
    ? value
    : DEFAULT_AI_SUPPORT_RETENTION_DAYS;
}

/** Chats whose last activity is before this moment have expired. */
export function retentionCutoff(days: number, now: Date = new Date()): Date {
  return new Date(now.getTime() - days * DAY_MS);
}

/** Last activity before the cutoff. */
export function expiredConversationWhere(cutoff: Date): Prisma.AiSupportConversationWhereInput {
  return {
    OR: [{ lastMessageAt: { lt: cutoff } }, { lastMessageAt: null, createdAt: { lt: cutoff } }],
  };
}

/** Still within the retention period: the only chats any endpoint may return or extend. */
export function activeConversationWhere(cutoff: Date): Prisma.AiSupportConversationWhereInput {
  return {
    OR: [{ lastMessageAt: { gte: cutoff } }, { lastMessageAt: null, createdAt: { gte: cutoff } }],
  };
}

export interface RetentionResult {
  conversations: number;
  messages: number;
}

type RetentionClient = Pick<PrismaClient, 'aiSupportConversation' | 'aiSupportMessage'>;

/**
 * Deletes expired chats in small batches. Messages go with their chat through
 * the ON DELETE CASCADE foreign key; nothing outside these two tables is
 * touched. Safe to run repeatedly or from several processes at once: a chat
 * already deleted by another run is simply not counted again.
 */
export async function deleteExpiredConversations(
  prisma: RetentionClient,
  cutoff: Date,
  options: { batchSize?: number; dryRun?: boolean } = {},
): Promise<RetentionResult> {
  const batchSize = options.batchSize ?? 500;
  const where = expiredConversationWhere(cutoff);
  if (options.dryRun) {
    const [conversations, messages] = await Promise.all([
      prisma.aiSupportConversation.count({ where }),
      prisma.aiSupportMessage.count({ where: { conversation: where } }),
    ]);
    return { conversations, messages };
  }

  const result: RetentionResult = { conversations: 0, messages: 0 };
  for (;;) {
    const batch = await prisma.aiSupportConversation.findMany({
      where,
      select: { id: true },
      orderBy: { createdAt: 'asc' },
      take: batchSize,
    });
    if (batch.length === 0) return result;
    // The expiry is checked again, so a chat that got a message meanwhile is kept.
    const target: Prisma.AiSupportConversationWhereInput = { AND: [{ id: { in: batch.map((row) => row.id) } }, where] };
    // Counted for the log only; the messages themselves are removed by the cascade.
    const messages = await prisma.aiSupportMessage.count({ where: { conversation: target } });
    const deleted = await prisma.aiSupportConversation.deleteMany({ where: target });
    result.conversations += deleted.count;
    result.messages += messages;
    if (batch.length < batchSize) return result;
  }
}
