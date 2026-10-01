import { HttpException, HttpStatus, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import { Prisma } from '@prisma/client';
import type {
  AdminSupportConversation,
  AdminSupportConversationSummary,
  OffsetPageMeta,
} from '@ecomesta/types';
import { RedisRateLimitService } from '../../common/rate-limit/redis-rate-limit.service';
import { clientIp } from '../../common/utils/request-host.util';
import { PrismaService } from '../../prisma/prisma.service';
import { activeConversationWhere, retentionCutoff, retentionDays } from './ai-support-retention';

/** New chats a single address may start per hour. */
export const CHAT_STARTS_PER_IP_PER_HOUR = 10;

export interface ConversationCredentials {
  conversationId: string;
  conversationToken: string;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Error name and Prisma code only: database messages can quote the values (chat text, contact details). */
function errorSummary(err: unknown): string {
  const code = (err as { code?: unknown } | null)?.code;
  return `${err instanceof Error ? err.name : 'unknown'}${typeof code === 'string' ? ` ${code}` : ''}`;
}

function sameHash(a: string, b: string): boolean {
  const left = Buffer.from(a, 'hex');
  const right = Buffer.from(b, 'hex');
  return left.length === right.length && timingSafeEqual(left, right);
}

type ConversationRow = Prisma.AiSupportConversationGetPayload<{
  include: { messages: { where: { role: 'USER' }; orderBy: { createdAt: 'asc' }; take: 1 } };
}>;

function summary(row: ConversationRow): AdminSupportConversationSummary {
  const first = row.messages[0]?.content ?? null;
  return {
    id: row.id,
    visitorName: row.visitorName,
    visitorPhone: row.visitorPhone,
    visitorEmail: row.visitorEmail,
    messageCount: row.messageCount,
    firstMessage: first && first.length > 140 ? `${first.slice(0, 139)}…` : first,
    handoffReference: row.handoffReference,
    lastMessageAt: row.lastMessageAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Stores website support chats so Super Admins can read them. A visitor starts
 * a conversation with their name and phone (email optional) and gets a secret
 * token; only a request carrying that token can add messages to it.
 */
@Injectable()
export class AiSupportConversationsService {
  private readonly logger = new Logger(AiSupportConversationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rateLimit: RedisRateLimitService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Only chats within the retention period exist as far as any endpoint is
   * concerned, even before the cleanup job has deleted the expired ones.
   */
  private active(): Prisma.AiSupportConversationWhereInput {
    return activeConversationWhere(
      retentionCutoff(retentionDays(this.config.get<unknown>('AI_SUPPORT_RETENTION_DAYS'))),
    );
  }

  async start(
    input: { name: string; phone: string; email?: string },
    req: Request,
  ): Promise<{ conversationId: string; conversationToken: string }> {
    const ip = clientIp(req) ?? 'unknown';
    if (!(await this.rateLimit.consume(`ai-support:start-ip:${ip}`, CHAT_STARTS_PER_IP_PER_HOUR, 60 * 60))) {
      throw new HttpException(
        { message: "You're starting chats very quickly. Please wait a little and try again.", error: 'RATE_LIMITED' },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    const token = randomBytes(24).toString('base64url');
    const userAgent = req.headers['user-agent'];
    const row = await this.prisma.aiSupportConversation.create({
      data: {
        visitorName: input.name.trim(),
        visitorPhone: input.phone,
        visitorEmail: input.email?.trim().toLowerCase() || null,
        tokenHash: hashToken(token),
        userAgent: typeof userAgent === 'string' ? userAgent.slice(0, 300) : null,
      },
      select: { id: true },
    });
    return { conversationId: row.id, conversationToken: token };
  }

  /** Throws unless the token belongs to the conversation. */
  async authorize(credentials: ConversationCredentials): Promise<void> {
    const row = await this.prisma.aiSupportConversation.findFirst({
      where: { AND: [{ id: credentials.conversationId }, this.active()] },
      select: { tokenHash: true },
    });
    if (!row || !sameHash(row.tokenHash, hashToken(credentials.conversationToken))) {
      throw new HttpException(
        { message: 'This chat has ended. Please start a new chat.', error: 'CHAT_NOT_FOUND' },
        HttpStatus.NOT_FOUND,
      );
    }
  }

  /**
   * Saves the visitor's message and the reply they were shown. Saving must
   * never cost the visitor their answer, so failures are only logged.
   */
  async recordExchange(
    conversationId: string,
    exchange: { question: string; reply: string; handoffReason: string | null },
  ): Promise<void> {
    const askedAt = new Date();
    // One millisecond apart so the reply always sorts after the question.
    const answeredAt = new Date(askedAt.getTime() + 1);
    try {
      await this.prisma.$transaction([
        this.prisma.aiSupportMessage.create({
          data: { conversationId, role: 'USER', content: exchange.question, createdAt: askedAt },
        }),
        this.prisma.aiSupportMessage.create({
          data: {
            conversationId,
            role: 'ASSISTANT',
            content: exchange.reply,
            handoffReason: exchange.handoffReason,
            createdAt: answeredAt,
          },
        }),
        this.prisma.aiSupportConversation.update({
          where: { id: conversationId },
          data: { messageCount: { increment: 2 }, lastMessageAt: answeredAt },
        }),
      ]);
    } catch (err) {
      this.logger.warn(`ai-support conversation ${conversationId} not saved: ${errorSummary(err)}`);
    }
  }

  async linkHandoff(conversationId: string, reference: string): Promise<void> {
    try {
      await this.prisma.aiSupportConversation.update({
        where: { id: conversationId },
        data: { handoffReference: reference },
      });
    } catch (err) {
      this.logger.warn(`ai-support handoff ${reference} not linked to ${conversationId}: ${errorSummary(err)}`);
    }
  }

  async adminList(query: { page?: number; limit?: number; search?: string }): Promise<{
    items: AdminSupportConversationSummary[];
    meta: OffsetPageMeta;
  }> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const search = query.search?.trim();
    const digits = search?.replace(/[\s\-().]/g, '');
    const matches: Prisma.AiSupportConversationWhereInput = search
      ? {
          OR: [
            { visitorName: { contains: search, mode: 'insensitive' } },
            { visitorEmail: { contains: search, mode: 'insensitive' } },
            ...(digits && /^\+?\d+$/.test(digits) ? [{ visitorPhone: { contains: digits } }] : []),
            { handoffReference: { equals: search.replace(/^#/, '').toUpperCase() } },
          ],
        }
      : {};
    const where: Prisma.AiSupportConversationWhereInput = { AND: [this.active(), matches] };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.aiSupportConversation.count({ where }),
      this.prisma.aiSupportConversation.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { messages: { where: { role: 'USER' }, orderBy: { createdAt: 'asc' }, take: 1 } },
      }),
    ]);
    return {
      items: rows.map(summary),
      meta: { total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) },
    };
  }

  async adminGet(id: string): Promise<AdminSupportConversation> {
    const row = await this.prisma.aiSupportConversation.findFirst({
      where: { AND: [{ id }, this.active()] },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!row) throw new NotFoundException('Conversation not found');
    const firstUser = row.messages.filter((message) => message.role === 'USER').slice(0, 1);
    return {
      ...summary({ ...row, messages: firstUser }),
      userAgent: row.userAgent,
      messages: row.messages.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        handoffReason: message.handoffReason,
        createdAt: message.createdAt.toISOString(),
      })),
    };
  }
}
