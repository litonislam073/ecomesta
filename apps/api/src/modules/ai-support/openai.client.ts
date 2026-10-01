import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Minimal Chat Completions shapes used by the support agent. */
export interface ChatToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export type ChatMessage =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: ChatToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string };

export interface ChatToolDefinition {
  type: 'function';
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

export interface ChatCompletionRequest {
  messages: ChatMessage[];
  tools?: ChatToolDefinition[];
  toolChoice?: 'auto' | 'none';
  maxOutputTokens: number;
}

export interface ChatCompletionResult {
  message: { content: string | null; tool_calls?: ChatToolCall[] };
  finishReason: string | null;
  usage: { promptTokens: number; completionTokens: number } | null;
}

/** Raised for any failure talking to the model; never carries the API key or response bodies. */
export class AiProviderError extends Error {
  constructor(
    readonly kind: 'not_configured' | 'timeout' | 'rate_limited' | 'upstream' | 'invalid_response',
    readonly status: number | null = null,
  ) {
    super(`AI provider error: ${kind}${status ? ` (${status})` : ''}`);
    this.name = 'AiProviderError';
  }
}

export interface AiChatClient {
  isConfigured(): boolean;
  model(): string;
  complete(request: ChatCompletionRequest, deadline: number): Promise<ChatCompletionResult>;
}

export const AI_CHAT_CLIENT = Symbol('AI_CHAT_CLIENT');

const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';
export const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';
const RETRY_DELAY_MS = 600;

/**
 * OpenAI Chat Completions over HTTPS. The key stays on the server; one retry
 * for timeouts, network errors, 429 and 5xx, and only while time remains.
 */
@Injectable()
export class OpenAiChatClient implements AiChatClient {
  constructor(private readonly config: ConfigService) {}

  private apiKey(): string | null {
    return this.config.get<string>('OPENAI_API_KEY')?.trim() || null;
  }

  isConfigured(): boolean {
    return this.apiKey() !== null;
  }

  model(): string {
    return this.config.get<string>('OPENAI_MODEL')?.trim() || DEFAULT_OPENAI_MODEL;
  }

  async complete(request: ChatCompletionRequest, deadline: number): Promise<ChatCompletionResult> {
    const key = this.apiKey();
    if (!key) throw new AiProviderError('not_configured');
    try {
      return await this.attempt(key, request, deadline);
    } catch (err) {
      const retryable =
        err instanceof AiProviderError &&
        (err.kind === 'timeout' || err.kind === 'rate_limited' || (err.kind === 'upstream' && (err.status ?? 500) >= 500));
      if (!retryable || deadline - Date.now() < 4000) throw err;
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      return this.attempt(key, request, deadline);
    }
  }

  private async attempt(key: string, request: ChatCompletionRequest, deadline: number): Promise<ChatCompletionResult> {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new AiProviderError('timeout');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), remaining);
    let response: Response;
    try {
      response = await fetch(OPENAI_CHAT_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model(),
          messages: request.messages,
          ...(request.tools?.length ? { tools: request.tools, tool_choice: request.toolChoice ?? 'auto' } : {}),
          max_completion_tokens: request.maxOutputTokens,
          temperature: 0.4,
        }),
        signal: controller.signal,
      });
    } catch {
      throw new AiProviderError(controller.signal.aborted ? 'timeout' : 'upstream');
    } finally {
      clearTimeout(timer);
    }
    if (response.status === 429) throw new AiProviderError('rate_limited', 429);
    if (!response.ok) throw new AiProviderError('upstream', response.status);

    let body: {
      choices?: { message?: { content?: string | null; tool_calls?: ChatToolCall[] }; finish_reason?: string }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    try {
      body = (await response.json()) as typeof body;
    } catch {
      throw new AiProviderError('invalid_response', response.status);
    }
    const choice = body.choices?.[0];
    if (!choice?.message) throw new AiProviderError('invalid_response', response.status);
    return {
      message: { content: choice.message.content ?? null, tool_calls: choice.message.tool_calls },
      finishReason: choice.finish_reason ?? null,
      usage: body.usage
        ? { promptTokens: body.usage.prompt_tokens ?? 0, completionTokens: body.usage.completion_tokens ?? 0 }
        : null,
    };
  }
}
