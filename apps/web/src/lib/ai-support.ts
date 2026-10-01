import { isLoopbackHost, isPlatformMarketingHost } from '@/lib/domain-routing';
import { publicPost, PublicApiError } from '@/lib/public-api';

/**
 * The AI support agent belongs to the Ecomesta platform website only. Store
 * subdomains and merchants' custom domains never show it, even if a marketing
 * component were rendered there by mistake.
 */
export function isAiSupportHost(hostname: string): boolean {
  const host = hostname.trim().toLowerCase();
  if (!host) return false;
  // `{store}.localhost` previews a merchant store locally: never there.
  if (host.endsWith('.localhost')) return false;
  // Local development serves the marketing site on localhost / 127.0.0.1.
  if (isLoopbackHost(host)) return true;
  return isPlatformMarketingHost(host);
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatEntry extends ChatTurn {
  id: string;
  /** Assistant replies that suggested a person: the website shows the support form. */
  handoff?: { reason: string } | null;
  /** Support form state for this reply. */
  handoffResult?: { reference: string; email: string; phone?: string } | null;
}

/** Who is chatting: asked for before the chat starts. Name and phone are required. */
export interface VisitorDetails {
  name: string;
  phone: string;
  email: string;
}

/** A started chat: the visitor's details and the secret that lets this tab add messages to it. */
export interface ChatSession extends VisitorDetails {
  conversationId: string;
  conversationToken: string;
}

export const MAX_MESSAGE_CHARS = 1000;
const MAX_STORED = 40;
const STORAGE_KEY = 'ecomesta_ai_support_v1';
const VISITOR_KEY = 'ecomesta_ai_support_visitor_v1';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REQUEST_TIMEOUT_MS = 35_000;

export const GENERIC_ERROR =
  "I'm having trouble responding right now. Please try again in a moment or contact our support team.";

/** The browser tab keeps its own copy to show the chat; the server saves it for the Ecomesta team. */
export function loadConversation(): ChatEntry[] {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (entry): entry is ChatEntry =>
          !!entry &&
          typeof entry === 'object' &&
          ((entry as ChatEntry).role === 'user' || (entry as ChatEntry).role === 'assistant') &&
          typeof (entry as ChatEntry).content === 'string',
      )
      .slice(-MAX_STORED);
  } catch {
    return [];
  }
}

export function saveConversation(entries: ChatEntry[]): void {
  try {
    if (entries.length === 0) window.sessionStorage.removeItem(STORAGE_KEY);
    else window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(-MAX_STORED)));
  } catch {
    /* storage unavailable (private mode): the chat still works for this page */
  }
}

/** 6–15 digits once spaces, dashes and brackets are removed (e.g. 01711-000000, +8801711000000). */
export function normalizePhone(value: string): string {
  return value.replace(/[\s\-().]/g, '');
}

export function isValidPhone(value: string): boolean {
  return /^\+?\d{6,15}$/.test(normalizePhone(value));
}

export function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim());
}

/** Field errors for the start-chat form; empty when the details can be used. */
export function visitorDetailsErrors(details: VisitorDetails): Partial<Record<keyof VisitorDetails, string>> {
  const errors: Partial<Record<keyof VisitorDetails, string>> = {};
  if (details.name.trim().length < 2) errors.name = 'Please enter your name.';
  if (!details.phone.trim()) errors.phone = 'Please enter your phone number.';
  else if (!isValidPhone(details.phone)) errors.phone = 'Please enter a valid phone number.';
  if (details.email.trim() && !isValidEmail(details.email)) errors.email = 'Please enter a valid email or leave it empty.';
  return errors;
}

/** The started chat for this browser tab, if any. */
export function loadSession(): ChatSession | null {
  try {
    const raw = window.sessionStorage.getItem(VISITOR_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ChatSession> | null;
    const text = (value: unknown) => (typeof value === 'string' ? value : '');
    const session: ChatSession = {
      name: text(parsed?.name),
      phone: text(parsed?.phone),
      email: text(parsed?.email),
      conversationId: text(parsed?.conversationId),
      conversationToken: text(parsed?.conversationToken),
    };
    if (!session.conversationId || !session.conversationToken) return null;
    return Object.keys(visitorDetailsErrors(session)).length === 0 ? session : null;
  } catch {
    return null;
  }
}

export function saveSession(session: ChatSession | null): void {
  try {
    if (session) window.sessionStorage.setItem(VISITOR_KEY, JSON.stringify(session));
    else window.sessionStorage.removeItem(VISITOR_KEY);
  } catch {
    /* storage unavailable: the chat is kept for this page only */
  }
}

export type StartOutcome = { ok: true; session: ChatSession } | { ok: false; message: string };

/** Starts a chat on the server; it is saved so the Ecomesta team can read it. */
export async function startSupportChat(details: VisitorDetails): Promise<StartOutcome> {
  try {
    const result = await publicPost<{ success: true; data: { conversationId: string; conversationToken: string } }>(
      '/ai-support/conversations',
      {
        name: details.name,
        phone: normalizePhone(details.phone),
        ...(details.email ? { email: details.email } : {}),
      },
    );
    return { ok: true, session: { ...details, ...result.data } };
  } catch (err) {
    if (err instanceof PublicApiError && err.status === 429) return { ok: false, message: err.message };
    if (err instanceof PublicApiError && err.status === 400) {
      return { ok: false, message: 'Please check your name, phone number and email.' };
    }
    return { ok: false, message: 'We could not start the chat right now. Please try again in a moment.' };
  }
}

export type ChatOutcome =
  | { ok: true; reply: string; handoff: { reason: string } | null }
  /** `restart`: the server no longer knows this chat, so a new one must be started. */
  | { ok: false; message: string; retryable: boolean; restart?: boolean };

export async function askAiSupport(
  turns: ChatTurn[],
  session: Pick<ChatSession, 'conversationId' | 'conversationToken'>,
): Promise<ChatOutcome> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const result = await publicPost<{
      success: true;
      data: { reply: string; handoff: { reason: string } | null };
    }>(
      '/ai-support/chat',
      {
        messages: turns.slice(-20),
        conversationId: session.conversationId,
        conversationToken: session.conversationToken,
      },
      { signal: controller.signal },
    );
    return { ok: true, reply: result.data.reply, handoff: result.data.handoff };
  } catch (err) {
    if (err instanceof PublicApiError && err.code === 'CHAT_NOT_FOUND') {
      return { ok: false, message: err.message, retryable: false, restart: true };
    }
    if (err instanceof PublicApiError && err.status < 500) {
      return { ok: false, message: err.message, retryable: err.status === 429 };
    }
    if (err instanceof PublicApiError && err.status === 503 && err.message !== 'Internal server error') {
      return { ok: false, message: err.message, retryable: true };
    }
    return { ok: false, message: GENERIC_ERROR, retryable: true };
  } finally {
    window.clearTimeout(timer);
  }
}

export type HandoffOutcome = { ok: true; reference: string } | { ok: false; message: string };

export async function requestHumanSupport(input: {
  name: string;
  phone: string;
  email: string;
  message: string;
  reason?: string;
  transcript: ChatTurn[];
  website: string;
  session?: Pick<ChatSession, 'conversationId' | 'conversationToken'> | null;
}): Promise<HandoffOutcome> {
  try {
    const result = await publicPost<{ success: true; data: { submitted: true; reference: string } }>(
      '/ai-support/handoff',
      {
        name: input.name,
        phone: normalizePhone(input.phone),
        ...(input.email.trim() ? { email: input.email.trim() } : {}),
        message: input.message,
        ...(input.reason ? { reason: input.reason } : {}),
        transcript: input.transcript.slice(-10).map((turn) => ({ role: turn.role, content: turn.content.slice(0, 1000) })),
        ...(input.website ? { website: input.website } : {}),
        ...(input.session
          ? { conversationId: input.session.conversationId, conversationToken: input.session.conversationToken }
          : {}),
      },
    );
    return { ok: true, reference: result.data.reference };
  } catch (err) {
    if (err instanceof PublicApiError && err.status < 500 && err.status !== 429) {
      return { ok: false, message: 'Please check your name, phone number, email and message (at least 10 characters).' };
    }
    if (err instanceof PublicApiError && err.message !== 'Internal server error') {
      return { ok: false, message: err.message };
    }
    return { ok: false, message: 'We could not send your request right now. Please email us or try again later.' };
  }
}

/** Blocks of a reply: paragraphs and simple "- " / "1." lists. Rendered as text, never HTML. */
export type ReplyBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'list'; ordered: boolean; items: string[] };

export function parseReply(text: string): ReplyBlock[] {
  const blocks: ReplyBlock[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let paragraph: string[] = [];
  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ type: 'paragraph', text: paragraph.join(' ') });
    paragraph = [];
  };
  const flushList = () => {
    if (list) blocks.push({ type: 'list', ...list });
    list = null;
  };
  for (const rawLine of text.replace(/\r/g, '').split('\n')) {
    const line = rawLine.trim();
    const bullet = /^[-*•]\s+(.*)$/.exec(line);
    const numbered = /^\d+[.)]\s+(.*)$/.exec(line);
    if (bullet || numbered) {
      flushParagraph();
      const ordered = Boolean(numbered);
      if (!list || list.ordered !== ordered) {
        flushList();
        list = { ordered, items: [] };
      }
      list.items.push((bullet ?? numbered)![1]!);
    } else if (!line) {
      flushParagraph();
      flushList();
    } else {
      flushList();
      paragraph.push(line);
    }
  }
  flushParagraph();
  flushList();
  return blocks;
}

/** Splits `**bold**` runs so they can be rendered as <strong> text. */
export function splitBold(text: string): { text: string; bold: boolean }[] {
  return text
    .split(/(\*\*[^*]+\*\*)/g)
    .filter(Boolean)
    .map((part) => (part.startsWith('**') && part.endsWith('**') ? { text: part.slice(2, -2), bold: true } : { text: part, bold: false }));
}

export interface InlinePart {
  text: string;
  bold: boolean;
  /** Set only for pages of the Ecomesta website. */
  href?: string;
}

// The API already replaces paths that are not real pages, so the widget only
// needs to know the website's sections (kept small: no content in the bundle).
const SITE_PATH =
  /^\/(?:(?:features|payments|shipping|solutions|blog)(?:\/[a-z0-9-]+)?|pricing|resources|faq|about|contact)?$/;

/**
 * Returns the website path for a link the assistant wrote ("/pricing" or
 * "https://ecomesta.com/pricing"), or null when it is not an Ecomesta page.
 */
export function sitePath(target: string): string | null {
  const path = target.trim().replace(/^https?:\/\/(www\.)?ecomesta\.com(?=\/|$)/i, '') || '/';
  const clean = path.length > 1 ? path.replace(/\/+$/, '') : path;
  return SITE_PATH.test(clean) ? clean : null;
}

const INLINE_LINK = /\[([^\]\n]+)\]\(([^)\s]+)\)|(?<![\w/.:])(\/[a-z0-9-]+(?:\/[a-z0-9-]+)*)/gi;

/** Splits bold text, markdown links and bare site paths; only our own pages become links. */
export function splitInline(text: string): InlinePart[] {
  const parts: InlinePart[] = [];
  for (const bold of splitBold(text)) {
    let last = 0;
    for (const match of bold.text.matchAll(INLINE_LINK)) {
      const [whole, label, target, barePath] = match;
      const href = sitePath(target ?? barePath!);
      if (match.index > last) parts.push({ text: bold.text.slice(last, match.index), bold: bold.bold });
      parts.push(href ? { text: label ?? barePath!, bold: bold.bold, href } : { text: label ?? whole, bold: bold.bold });
      last = match.index + whole.length;
    }
    if (last < bold.text.length) parts.push({ text: bold.text.slice(last), bold: bold.bold });
  }
  return parts;
}

/**
 * How replies are paced so they read like a person typing: a short pause with
 * the typing dots (longer for longer answers), then the text appears gradually.
 */
export const replyPacing = {
  minThinkMs: 900,
  maxThinkMs: 2400,
  thinkMsPerChar: 4,
  tickMs: 30,
  maxTypeMs: 3500,
  charsPerSecond: 70,
};

export function thinkingDelay(reply: string): number {
  const { minThinkMs, maxThinkMs, thinkMsPerChar } = replyPacing;
  return Math.min(maxThinkMs, minThinkMs + reply.length * thinkMsPerChar);
}

/** User-perceived characters, so Bangla vowel signs never appear on their own. */
export function graphemes(text: string): string[] {
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    return Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text), (part) => part.segment);
  }
  return Array.from(text);
}

/** Characters revealed per tick: natural speed, but long answers finish within maxTypeMs. */
export function typingStep(totalChars: number): number {
  const { tickMs, maxTypeMs, charsPerSecond } = replyPacing;
  const natural = (charsPerSecond * tickMs) / 1000;
  const needed = totalChars / Math.max(1, maxTypeMs / tickMs);
  return Math.max(1, Math.ceil(Math.max(natural, needed)));
}
