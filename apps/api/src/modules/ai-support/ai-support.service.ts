import { HttpException, HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import type { Request } from 'express';
import type { PublicPlan } from '@ecomesta/types';
import { PublicServiceUnavailableException } from '../../common/filters/public-service-unavailable.exception';
import { RedisRateLimitService } from '../../common/rate-limit/redis-rate-limit.service';
import { clientIp } from '../../common/utils/request-host.util';
import { BillingService } from '../billing/billing.service';
import { EmailService } from '../email/email.service';
import { AiSupportKnowledge } from './ai-support.knowledge';
import { STYLE_HINT, detectLanguageStyle, fallbackMessage, type LanguageStyle } from './ai-support.language';
import { buildSystemPrompt } from './ai-support.prompts';
import { fixSitePaths, isUnsafeOutput } from './ai-support.safety';
import { AI_SUPPORT_TOOLS, runAiSupportTool, type ToolContext } from './ai-support.tools';
import {
  AI_CHAT_CLIENT,
  AiProviderError,
  type AiChatClient,
  type ChatMessage,
} from './openai.client';

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface AiSupportReply {
  reply: string;
  language: LanguageStyle;
  /** Set when the agent suggests talking to a person; the website then shows the support form. */
  handoff: { reason: string } | null;
}

/** Cost and abuse limits for anonymous chat. */
export const AI_SUPPORT_LIMITS = {
  maxUserMessageChars: 1000,
  maxHistoryMessages: 12,
  maxHistoryChars: 8000,
  maxAssistantChars: 1500,
  maxToolRounds: 3,
  maxOutputTokens: 700,
  requestTimeoutMs: 25_000,
  perIpPerMinute: 15,
  perIpPerDay: 150,
  defaultDailyRequests: 5000,
  handoffPerIpPerHour: 3,
  handoffPerContactPerDay: 3,
} as const;

const PLANS_CACHE_MS = 5 * 60 * 1000;

@Injectable()
export class AiSupportService {
  private readonly logger = new Logger(AiSupportService.name);
  private plansCache: { at: number; plans: PublicPlan[] } | null = null;

  constructor(
    @Inject(AI_CHAT_CLIENT) private readonly client: AiChatClient,
    private readonly knowledge: AiSupportKnowledge,
    private readonly billing: BillingService,
    private readonly email: EmailService,
    private readonly rateLimit: RedisRateLimitService,
    private readonly config: ConfigService,
  ) {}

  async chat(turns: ChatTurn[], req: Request): Promise<AiSupportReply> {
    const latest = turns.at(-1);
    const style = detectLanguageStyle(latest?.content ?? '');
    if (!latest || latest.role !== 'user' || !latest.content.trim()) {
      throw this.error(HttpStatus.BAD_REQUEST, 'INVALID_CONVERSATION', 'Send a message to start the conversation.');
    }
    if (latest.content.length > AI_SUPPORT_LIMITS.maxUserMessageChars) {
      throw this.error(HttpStatus.BAD_REQUEST, 'MESSAGE_TOO_LONG', fallbackMessage('tooLong', style));
    }

    const ip = clientIp(req) ?? 'unknown';
    const day = new Date().toISOString().slice(0, 10);
    const allowed =
      (await this.rateLimit.consume(`ai-support:ip-min:${ip}`, AI_SUPPORT_LIMITS.perIpPerMinute, 60)) &&
      (await this.rateLimit.consume(`ai-support:ip-day:${ip}`, AI_SUPPORT_LIMITS.perIpPerDay, 24 * 60 * 60));
    if (!allowed) {
      throw this.error(HttpStatus.TOO_MANY_REQUESTS, 'RATE_LIMITED', fallbackMessage('rateLimited', style));
    }
    if (!this.client.isConfigured()) {
      throw this.error(HttpStatus.SERVICE_UNAVAILABLE, 'AI_DISABLED', fallbackMessage('disabled', style));
    }
    if (!(await this.rateLimit.consume(`ai-support:global:${day}`, this.dailyLimit(), 26 * 60 * 60))) {
      this.logger.warn('AI support daily request budget reached');
      throw this.error(HttpStatus.SERVICE_UNAVAILABLE, 'AI_UNAVAILABLE', fallbackMessage('unavailable', style));
    }

    const requestId = randomUUID();
    const started = Date.now();
    const deadline = started + AI_SUPPORT_LIMITS.requestTimeoutMs;
    const context: ToolContext = {
      knowledge: this.knowledge,
      plans: () => this.publicPlans(),
      supportEmail: this.email.supportEmail(),
      handoff: null,
    };
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: buildSystemPrompt({
          plans: await this.publicPlans(),
          style,
          supportEmail: context.supportEmail,
          reference: this.knowledge.search(latest.content, 3, 2500),
        }),
      },
      ...trimHistory(turns),
      // Repeated after the history so earlier turns in another language don't win.
      { role: 'system', content: `${STYLE_HINT[style]} Only answer if it is about Ecomesta.` },
    ];
    const toolsUsed: string[] = [];
    let promptTokens = 0;
    let completionTokens = 0;

    try {
      for (let round = 0; ; round += 1) {
        const finalRound = round >= AI_SUPPORT_LIMITS.maxToolRounds;
        const result = await this.client.complete(
          {
            messages,
            tools: AI_SUPPORT_TOOLS,
            toolChoice: finalRound ? 'none' : 'auto',
            maxOutputTokens: AI_SUPPORT_LIMITS.maxOutputTokens,
          },
          deadline,
        );
        promptTokens += result.usage?.promptTokens ?? 0;
        completionTokens += result.usage?.completionTokens ?? 0;
        const calls = result.message.tool_calls ?? [];
        if (calls.length > 0 && !finalRound) {
          messages.push({ role: 'assistant', content: result.message.content, tool_calls: calls });
          for (const call of calls.slice(0, 4)) {
            const { result: output, tool } = await runAiSupportTool(call.function.name, call.function.arguments, context);
            toolsUsed.push(tool ?? 'refused');
            messages.push({ role: 'tool', tool_call_id: call.id, content: output });
          }
          // A call beyond the four we ran still needs an answer for the conversation to stay valid.
          for (const call of calls.slice(4)) {
            messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify({ error: 'Too many tool calls' }) });
          }
          continue;
        }

        const text = (result.message.content ?? '').trim();
        if (!text) throw new AiProviderError('invalid_response');
        const blocked = isUnsafeOutput(text);
        this.logger.log(
          `ai-support ${requestId} ok in ${Date.now() - started}ms rounds=${round + 1} tools=${toolsUsed.join(',') || '-'} tokens=${promptTokens}/${completionTokens} lang=${style}${blocked ? ' output_blocked' : ''}`,
        );
        return {
          reply: blocked ? fallbackMessage('blocked', style) : fixSitePaths(text),
          language: style,
          handoff: context.handoff,
        };
      }
    } catch (err) {
      const kind = err instanceof AiProviderError ? err.kind : 'unexpected';
      const status = err instanceof AiProviderError && err.status ? ` status=${err.status}` : '';
      this.logger.warn(`ai-support ${requestId} failed after ${Date.now() - started}ms kind=${kind}${status}`);
      throw this.error(HttpStatus.SERVICE_UNAVAILABLE, 'AI_UNAVAILABLE', fallbackMessage('unavailable', style));
    }
  }

  /**
   * Sends the visitor's request to the support inbox. Only reports success
   * when the email is actually queued for delivery.
   */
  async handoff(
    input: { name: string; phone: string; email?: string; message: string; reason?: string; transcript?: ChatTurn[] },
    req: Request,
  ): Promise<{ submitted: true; reference: string }> {
    const style = detectLanguageStyle(input.message);
    if (!this.email.supportEmail()) {
      throw this.error(
        HttpStatus.SERVICE_UNAVAILABLE,
        'SUPPORT_UNAVAILABLE',
        style === 'en'
          ? 'We could not send your request right now. Please email us or try again later.'
          : 'এই মুহূর্তে আপনার অনুরোধ পাঠানো যায়নি। পরে আবার চেষ্টা করুন বা আমাদের ইমেইল করুন।',
      );
    }
    const ip = clientIp(req) ?? 'unknown';
    const email = input.email?.trim().toLowerCase() || null;
    const phone = input.phone.trim();
    const allowed =
      (await this.rateLimit.consume(`ai-support:handoff-ip:${ip}`, AI_SUPPORT_LIMITS.handoffPerIpPerHour, 60 * 60)) &&
      (await this.rateLimit.consume(`ai-support:handoff-phone:${phone}`, AI_SUPPORT_LIMITS.handoffPerContactPerDay, 24 * 60 * 60)) &&
      (!email ||
        (await this.rateLimit.consume(`ai-support:handoff-email:${email}`, AI_SUPPORT_LIMITS.handoffPerContactPerDay, 24 * 60 * 60)));
    if (!allowed) {
      throw this.error(HttpStatus.TOO_MANY_REQUESTS, 'RATE_LIMITED', fallbackMessage('rateLimited', style));
    }

    const reference = randomUUID().slice(0, 8).toUpperCase();
    try {
      await this.email.sendAiSupportHandoff({
        reference,
        name: input.name.trim(),
        phone,
        email,
        message: input.message.trim(),
        reason: input.reason?.trim().slice(0, 200) || null,
        language: style,
        submittedAt: new Date().toISOString(),
        transcript: (input.transcript ?? [])
          .slice(-10)
          .map((turn) => ({ role: turn.role, content: turn.content.slice(0, 1000) })),
      });
    } catch {
      this.logger.warn(`ai-support handoff ${reference} could not be queued`);
      throw this.error(
        HttpStatus.SERVICE_UNAVAILABLE,
        'SUPPORT_UNAVAILABLE',
        style === 'en'
          ? 'We could not send your request right now. Please email us or try again later.'
          : 'এই মুহূর্তে আপনার অনুরোধ পাঠানো যায়নি। পরে আবার চেষ্টা করুন বা আমাদের ইমেইল করুন।',
      );
    }
    this.logger.log(`ai-support handoff ${reference} queued`);
    return { submitted: true, reference };
  }

  private async publicPlans(): Promise<PublicPlan[]> {
    if (this.plansCache && Date.now() - this.plansCache.at < PLANS_CACHE_MS) return this.plansCache.plans;
    try {
      const plans = (await this.billing.listPublicPlans()).data;
      this.plansCache = { at: Date.now(), plans };
      return plans;
    } catch {
      return this.plansCache?.plans ?? [];
    }
  }

  private dailyLimit(): number {
    const raw = Number(this.config.get<string>('AI_SUPPORT_DAILY_REQUEST_LIMIT'));
    return Number.isInteger(raw) && raw > 0 ? raw : AI_SUPPORT_LIMITS.defaultDailyRequests;
  }

  private error(status: HttpStatus, code: string, message: string): HttpException {
    return status === HttpStatus.SERVICE_UNAVAILABLE
      ? new PublicServiceUnavailableException(message, code)
      : new HttpException({ message, error: code }, status);
  }
}

/** Newest turns within the message and character budget, oldest dropped first. */
export function trimHistory(turns: ChatTurn[]): ChatMessage[] {
  const kept: ChatMessage[] = [];
  let chars = 0;
  for (let i = turns.length - 1; i >= 0 && kept.length < AI_SUPPORT_LIMITS.maxHistoryMessages; i -= 1) {
    const turn = turns[i]!;
    const limit = turn.role === 'assistant' ? AI_SUPPORT_LIMITS.maxAssistantChars : AI_SUPPORT_LIMITS.maxUserMessageChars;
    const content = turn.content.slice(0, limit);
    if (chars + content.length > AI_SUPPORT_LIMITS.maxHistoryChars && kept.length > 0) break;
    kept.unshift({ role: turn.role, content });
    chars += content.length;
  }
  // The model should always see the conversation starting with the customer.
  while (kept.length > 1 && kept[0]!.role === 'assistant') kept.shift();
  return kept;
}
