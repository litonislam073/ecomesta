/**
 * Manual run of the support chat retention cleanup (it also runs on its own
 * every 6 hours inside the API). Without --delete it only reports what would
 * be deleted.
 *
 *   Production container:  node dist/cli/ai-support-retention.js [--delete]
 *   Local development:     pnpm --filter @ecomesta/api ai-support:retention [--delete]
 *
 * Uses DATABASE_URL and AI_SUPPORT_RETENTION_DAYS (default 365). Prints counts
 * only, never chat content or visitor contact details.
 */
import { PrismaClient } from '@prisma/client';
import {
  DEFAULT_AI_SUPPORT_RETENTION_DAYS,
  MAX_AI_SUPPORT_RETENTION_DAYS,
  deleteExpiredConversations,
  retentionCutoff,
  retentionDays,
} from '../modules/ai-support/ai-support-retention';

async function main(): Promise<number> {
  const raw = process.env.AI_SUPPORT_RETENTION_DAYS;
  if (raw !== undefined && raw.trim() !== '' && String(retentionDays(raw)) !== raw.trim()) {
    console.error(
      `AI_SUPPORT_RETENTION_DAYS must be a whole number of days from 1 to ${MAX_AI_SUPPORT_RETENTION_DAYS} (default ${DEFAULT_AI_SUPPORT_RETENTION_DAYS}).`,
    );
    return 1;
  }
  const days = retentionDays(raw);
  const remove = process.argv.includes('--delete');
  const cutoff = retentionCutoff(days);
  const prisma = new PrismaClient();
  try {
    const result = await deleteExpiredConversations(prisma, cutoff, { dryRun: !remove });
    process.stdout.write(
      `${JSON.stringify({
        mode: remove ? 'delete' : 'dry-run',
        retentionDays: days,
        cutoff: cutoff.toISOString(),
        conversations: result.conversations,
        messages: result.messages,
      })}\n`,
    );
    if (!remove && result.conversations > 0) process.stdout.write('Run again with --delete to remove them.\n');
    return 0;
  } catch (err) {
    console.error(`Support chat retention failed: ${err instanceof Error ? err.name : 'unknown error'}`);
    return 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main().then((code) => {
  process.exitCode = code;
});
