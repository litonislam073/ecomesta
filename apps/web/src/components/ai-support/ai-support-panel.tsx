'use client';

import { useEffect, useId, useRef, useState, type ComponentProps, type FormEvent, type KeyboardEvent, type Ref } from 'react';
import {
  MAX_MESSAGE_CHARS,
  askAiSupport,
  graphemes,
  isValidEmail,
  isValidPhone,
  loadConversation,
  loadSession,
  parseReply,
  requestHumanSupport,
  saveConversation,
  saveSession,
  splitInline,
  startSupportChat,
  thinkingDelay,
  typingStep,
  replyPacing,
  visitorDetailsErrors,
  type ChatEntry,
  type ChatSession,
  type VisitorDetails,
} from '@/lib/ai-support';
import { ChatIcon } from './ai-support-launcher';

const SUGGESTIONS = ['How much does Ecomesta cost?', 'কিভাবে অনলাইন স্টোর খুলব?', 'Can I use my own domain?'];

function newId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `m-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function prefersReducedMotion() {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

function ReplyText({ text }: { text: string }) {
  return (
    <div className="space-y-2">
      {parseReply(text).map((block, index) => {
        const inline = (value: string) =>
          splitInline(value).map((part, i) => {
            const content = part.bold ? <strong>{part.text}</strong> : part.text;
            return part.href ? (
              <a key={i} href={part.href} className="font-medium text-[var(--color-accent)] underline underline-offset-2 hover:text-[var(--color-accent-hover)]">
                {content}
              </a>
            ) : (
              <span key={i}>{content}</span>
            );
          });
        if (block.type === 'paragraph') return <p key={index}>{inline(block.text)}</p>;
        const ListTag = block.ordered ? 'ol' : 'ul';
        return (
          <ListTag key={index} className={`space-y-1 pl-5 ${block.ordered ? 'list-decimal' : 'list-disc'}`}>
            {block.items.map((item, i) => (
              <li key={i}>{inline(item)}</li>
            ))}
          </ListTag>
        );
      })}
    </div>
  );
}

const fieldClass =
  'w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]';

/** Asked once per tab before the first message: name and phone are required, email is optional. */
function StartChatForm({
  initial,
  notice,
  onStart,
}: {
  initial: VisitorDetails | null;
  /** Why the visitor is asked again, e.g. the previous chat ended. */
  notice: string | null;
  /** Resolves with an error message, or null once the chat has started. */
  onStart: (details: VisitorDetails) => Promise<string | null>;
}) {
  const formId = useId();
  const nameRef = useRef<HTMLInputElement>(null);
  const [details, setDetails] = useState<VisitorDetails>(initial ?? { name: '', phone: '', email: '' });
  const [errors, setErrors] = useState<Partial<Record<keyof VisitorDetails, string>>>({});
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const found = visitorDetailsErrors(details);
    setErrors(found);
    setFailure(null);
    if (Object.keys(found).length > 0) return;
    setBusy(true);
    const message = await onStart({ name: details.name.trim(), phone: details.phone.trim(), email: details.email.trim() });
    setBusy(false);
    if (message) setFailure(message);
  }

  const field = (key: keyof VisitorDetails, label: string, props: Partial<ComponentProps<'input'>>, inputRef?: Ref<HTMLInputElement>) => (
    <div>
      <label className="block text-xs font-medium text-[var(--color-muted)]">
        {label}
        <input
          {...props}
          ref={inputRef}
          className={`${fieldClass} mt-1 ${errors[key] ? 'border-[#d9826a]' : ''}`}
          value={details[key]}
          onChange={(e) => setDetails((current) => ({ ...current, [key]: e.target.value }))}
          aria-invalid={errors[key] ? true : undefined}
          aria-describedby={errors[key] ? `${formId}-${key}-error` : undefined}
        />
      </label>
      {/* Outside the label so the message is a description, not part of the field's name. */}
      {errors[key] ? (
        <p id={`${formId}-${key}-error`} className="mt-1 text-xs text-[#a3441f]">
          {errors[key]}
        </p>
      ) : null}
    </div>
  );

  return (
    <form onSubmit={submit} noValidate aria-labelledby={`${formId}-title`} className="space-y-3 rounded-2xl border border-[var(--color-border)] bg-white p-4 shadow-sm">
      <div>
        <p id={`${formId}-title`} className="text-sm font-semibold text-[var(--color-ink)]">
          Start a chat
        </p>
        <p className="mt-0.5 text-xs text-[var(--color-muted)]">Tell us who you are so our team can follow up if needed.</p>
        {notice ? <p className="mt-2 rounded-lg bg-[#fdf3ee] px-2.5 py-1.5 text-xs text-[#7a3218]">{notice}</p> : null}
      </div>
      {field('name', 'Your name', { autoComplete: 'name', required: true, maxLength: 100 }, nameRef)}
      {field('phone', 'Phone number', { type: 'tel', inputMode: 'tel', autoComplete: 'tel', required: true, maxLength: 24, placeholder: '01XXXXXXXXX' })}
      {field('email', 'Email (optional)', { type: 'email', inputMode: 'email', autoComplete: 'email', maxLength: 200 })}
      {failure ? (
        <p role="alert" className="text-xs text-[#a3441f]">
          {failure}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-lg bg-[var(--color-accent)] px-3 py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-accent-hover)] disabled:opacity-60"
      >
        {busy ? 'Starting…' : 'Start chat'}
      </button>
    </form>
  );
}

function HandoffForm({
  entry,
  transcript,
  visitor,
  onSent,
}: {
  entry: ChatEntry;
  transcript: ChatEntry[];
  visitor: ChatSession | null;
  onSent: (result: { reference: string; email: string; phone: string }) => void;
}) {
  const formId = useId();
  const lastQuestion = [...transcript].reverse().find((turn) => turn.role === 'user')?.content ?? '';
  const [name, setName] = useState(visitor?.name ?? '');
  const [phone, setPhone] = useState(visitor?.phone ?? '');
  const [email, setEmail] = useState(visitor?.email ?? '');
  const [message, setMessage] = useState(lastQuestion);
  const [website, setWebsite] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (entry.handoffResult) {
    return (
      <div role="status" className="mt-2 rounded-xl border border-[var(--brand-tint-strong)] bg-[var(--brand-green-tint)] p-3 text-sm text-[var(--brand-navy)]">
        Sent to our support team (reference #{entry.handoffResult.reference}).{' '}
        {entry.handoffResult.email
          ? `We will reply to ${entry.handoffResult.email}.`
          : `We will contact you on ${entry.handoffResult.phone}.`}
      </div>
    );
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (name.trim().length < 2 || !isValidPhone(phone) || (email.trim() && !isValidEmail(email)) || message.trim().length < 10) {
      setError('Please add your name, a valid phone number and a message of at least 10 characters. Email is optional.');
      return;
    }
    setBusy(true);
    const result = await requestHumanSupport({
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim(),
      message: message.trim(),
      reason: entry.handoff?.reason,
      transcript,
      website,
      session: visitor,
    });
    setBusy(false);
    if (result.ok) onSent({ reference: result.reference, email: email.trim(), phone: phone.trim() });
    else setError(result.message);
  }

  const input = fieldClass;
  return (
    <form onSubmit={submit} noValidate aria-labelledby={`${formId}-title`} className="mt-2 space-y-2 rounded-xl border border-[var(--color-border)] bg-white p-3">
      <p id={`${formId}-title`} className="text-sm font-semibold text-[var(--color-ink)]">
        Contact our support team
      </p>
      <label className="block text-xs font-medium text-[var(--color-muted)]">
        Name
        <input className={`${input} mt-1`} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
      </label>
      <label className="block text-xs font-medium text-[var(--color-muted)]">
        Phone number
        <input
          className={`${input} mt-1`}
          type="tel"
          inputMode="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          autoComplete="tel"
        />
      </label>
      <label className="block text-xs font-medium text-[var(--color-muted)]">
        Email (optional)
        <input
          className={`${input} mt-1`}
          type="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
      </label>
      <label className="block text-xs font-medium text-[var(--color-muted)]">
        How can we help?
        <textarea className={`${input} mt-1 min-h-20 resize-y`} value={message} maxLength={2000} onChange={(e) => setMessage(e.target.value)} />
      </label>
      {/* Hidden from people; bots that fill it are rejected. */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute left-[-9999px] h-0 w-0 opacity-0"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
      />
      {error ? (
        <p role="alert" className="text-xs text-[#a3441f]">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-lg bg-[var(--color-accent)] px-3 py-2 text-sm font-semibold text-white hover:bg-[var(--color-accent-hover)] disabled:opacity-60"
      >
        {busy ? 'Sending…' : 'Send to support'}
      </button>
    </form>
  );
}

export function AiSupportPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const titleId = useId();
  // The panel only ever renders in the browser (the launcher loads it with
  // ssr: false), so this tab's saved chat is read while the state is created.
  // Restoring it in an effect instead let the first save run with the empty
  // initial list and wipe the stored conversation.
  const [entries, setEntries] = useState<ChatEntry[]>(() => loadConversation());
  // Name and phone are required before the first message; null until given.
  const [visitor, setVisitor] = useState<ChatSession | null>(() => loadSession());
  // Set when the server no longer knows this tab's chat: ask again, details filled in.
  const [restart, setRestart] = useState<{ details: VisitorDetails; notice: string } | null>(null);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<{
    message: string;
    retryable: boolean;
    /** The chat could not answer: offer the support form instead (AI down, network, timeout). */
    offerSupport?: boolean;
    supportResult?: ChatEntry['handoffResult'];
  } | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const mounted = useRef(true);
  // The reply currently being "typed": its id and how many characters show.
  const [typing, setTyping] = useState<{ id: string; chars: string[]; shown: number } | null>(null);
  // Only a reply that is still partly hidden renders as "typing"; once every
  // character is out it renders as the finished reply straight away, so the full
  // text never sits in the temporary typing element and then moves.
  const typingReply =
    typing && typing.shown < typing.chars.length
      ? { id: typing.id, text: typing.chars.slice(0, typing.shown).join('') }
      : null;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!typing) return;
    if (typing.shown >= typing.chars.length) {
      setTyping(null);
      setPending(false);
      return;
    }
    const timer = window.setTimeout(
      () => setTyping((current) => current && { ...current, shown: current.shown + typingStep(current.chars.length) }),
      replyPacing.tickMs,
    );
    return () => window.clearTimeout(timer);
  }, [typing]);

  useEffect(() => {
    saveConversation(entries);
  }, [entries]);

  useEffect(() => {
    if (open) window.requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  // Escape also works when focus fell back to the page (e.g. a clicked button
  // disappeared); other elements' own Escape handling is left alone.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      const active = document.activeElement;
      if (event.key === 'Escape' && (!active || active === document.body)) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [entries, pending, error, typing]);

  async function send(history: ChatEntry[]) {
    if (!visitor) return;
    setPending(true);
    setError(null);
    const started = Date.now();
    const outcome = await askAiSupport(
      history.map(({ role, content }) => ({ role, content })),
      visitor,
    );
    if (outcome.ok) {
      // A person needs a moment to read and type; keep the typing dots up for it.
      const remaining = thinkingDelay(outcome.reply) - (Date.now() - started);
      if (remaining > 0) await wait(remaining);
    }
    if (!mounted.current) return;
    // Keep the keyboard in the conversation when the clicked control went away.
    window.requestAnimationFrame(() => {
      const active = document.activeElement;
      if (!active || active === document.body) inputRef.current?.focus();
    });
    if (outcome.ok) {
      const id = newId();
      setEntries([...history, { id, role: 'assistant', content: outcome.reply, handoff: outcome.handoff }]);
      if (prefersReducedMotion()) setPending(false);
      else setTyping({ id, chars: graphemes(outcome.reply), shown: 0 });
    } else if (outcome.restart) {
      setPending(false);
      saveSession(null);
      setRestart({
        details: { name: visitor.name, phone: visitor.phone, email: visitor.email },
        notice: outcome.message,
      });
      setVisitor(null);
    } else {
      setPending(false);
      setError({ message: outcome.message, retryable: outcome.retryable, offerSupport: true });
    }
  }

  async function startChat(details: VisitorDetails): Promise<string | null> {
    const outcome = await startSupportChat(details);
    if (!outcome.ok) return outcome.message;
    if (!mounted.current) return null;
    saveSession(outcome.session);
    setVisitor(outcome.session);
    setRestart(null);
    window.requestAnimationFrame(() => inputRef.current?.focus());
    return null;
  }

  function submit(text: string) {
    const content = text.trim();
    if (!content || pending || !visitor) return;
    if (content.length > MAX_MESSAGE_CHARS) {
      setError({ message: `Please keep messages under ${MAX_MESSAGE_CHARS} characters.`, retryable: false });
      return;
    }
    const history = [...entries, { id: newId(), role: 'user' as const, content }];
    setEntries(history);
    setDraft('');
    void send(history);
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit(draft);
    }
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          onClose();
        }
      }}
      className="fixed inset-0 z-[60] flex flex-col bg-white sm:inset-auto sm:bottom-6 sm:right-6 sm:h-[min(620px,calc(100vh-3rem))] sm:w-[390px] sm:overflow-hidden sm:rounded-2xl sm:border sm:border-[var(--color-border)] sm:shadow-[0_24px_60px_rgba(2,40,87,0.22)]"
    >
      <header className="flex items-center gap-3 bg-gradient-to-r from-[var(--brand-navy)] to-[var(--brand-blue-deep)] px-4 py-3 text-white">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15">
          <ChatIcon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="text-sm font-semibold">
            Ecomesta Support
          </h2>
          <p className="flex items-center gap-1.5 truncate text-xs text-white/75">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--brand-on-navy-accent)]" aria-hidden="true" />
            Online · English &amp; বাংলা
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEntries([]);
            setError(null);
            inputRef.current?.focus();
          }}
          disabled={entries.length === 0 || pending}
          aria-label="Clear conversation"
          title="Clear conversation"
          className="rounded-lg p-2 text-white/85 hover:bg-white/10 disabled:opacity-40"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4" aria-hidden="true">
            <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close chat"
          className="rounded-lg p-2 text-white/85 hover:bg-white/10"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
          </svg>
        </button>
      </header>

      <div ref={logRef} role="log" aria-live="polite" aria-label="Conversation" className="flex-1 space-y-3 overflow-y-auto bg-[var(--brand-paper)] px-4 py-4">
        <div className="max-w-[88%] rounded-2xl rounded-tl-md bg-white px-3.5 py-2.5 text-sm leading-relaxed text-[var(--color-ink)] shadow-sm">
          <p>
            {visitor ? `Hi ${visitor.name.split(/\s+/)[0]}! ` : 'Hi! '}Welcome to Ecomesta. How can we help with your online store today? You
            can write in English, বাংলা or Banglish.
          </p>
        </div>
        {!visitor ? (
          <StartChatForm initial={restart?.details ?? null} notice={restart?.notice ?? null} onStart={startChat} />
        ) : null}
        {visitor && entries.length === 0 ? (
          <div className="flex flex-wrap gap-2" aria-label="Suggested questions">
            {SUGGESTIONS.map((question) => (
              <button
                key={question}
                type="button"
                onClick={() => submit(question)}
                className="rounded-full border border-[var(--brand-tint-strong)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--color-accent)] hover:bg-[var(--brand-tint)]"
              >
                {question}
              </button>
            ))}
          </div>
        ) : null}

        {entries.map((entry, index) =>
          entry.role === 'user' ? (
            <div key={entry.id} className="flex justify-end">
              <p className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-tr-md bg-[var(--color-accent)] px-3.5 py-2.5 text-sm text-white">
                {entry.content}
              </p>
            </div>
          ) : (
            <div key={entry.id} className="max-w-[92%]">
              <div className="break-words rounded-2xl rounded-tl-md bg-white px-3.5 py-2.5 text-sm leading-relaxed text-[var(--color-ink)] shadow-sm">
                {typingReply?.id === entry.id ? (
                  // Screen readers get the reply once, when typing has finished.
                  <div aria-hidden="true" data-typing="">
                    <ReplyText text={typingReply.text} />
                  </div>
                ) : (
                  <ReplyText text={entry.content} />
                )}
              </div>
              {entry.handoff && typingReply?.id !== entry.id ? (
                <HandoffForm
                  entry={entry}
                  transcript={entries.slice(0, index + 1)}
                  visitor={visitor}
                  onSent={(result) =>
                    setEntries((current) => current.map((item) => (item.id === entry.id ? { ...item, handoffResult: result } : item)))
                  }
                />
              ) : null}
            </div>
          ),
        )}

        {pending && !typing ? (
          <div className="inline-flex items-center gap-1 rounded-2xl rounded-tl-md bg-white px-4 py-3 shadow-sm" role="status" aria-label="Ecomesta Support is typing">
            {[0, 1, 2].map((dot) => (
              <span key={dot} className="h-2 w-2 animate-bounce rounded-full bg-[var(--color-muted)]" style={{ animationDelay: `${dot * 150}ms` }} />
            ))}
          </div>
        ) : null}

        {error ? (
          <div role="alert" className="rounded-xl border border-[#f1c9b8] bg-[#fdf3ee] px-3 py-2.5 text-sm text-[#7a3218]">
            <p>{error.message}</p>
            {error.retryable && entries.at(-1)?.role === 'user' ? (
              <button
                type="button"
                onClick={() => void send(entries)}
                className="mt-2 rounded-lg border border-[#e7b9a5] bg-white px-3 py-1 text-xs font-semibold text-[#7a3218] hover:bg-[#fff7f3]"
              >
                Try again
              </button>
            ) : null}
          </div>
        ) : null}
        {/* The reply above tells the visitor to contact support; let them do it here. */}
        {error?.offerSupport && visitor && entries.at(-1)?.role === 'user' ? (
          <HandoffForm
            entry={{
              id: 'chat-unavailable',
              role: 'assistant',
              content: error.message,
              handoff: { reason: 'Chat could not answer' },
              handoffResult: error.supportResult ?? null,
            }}
            transcript={entries}
            visitor={visitor}
            onSent={(result) => setError((current) => current && { ...current, supportResult: result })}
          />
        ) : null}
      </div>

      {visitor ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submit(draft);
          }}
          className="border-t border-[var(--color-border)] bg-white px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3"
        >
          <div className="flex items-end gap-2">
            <label className="sr-only" htmlFor={`${titleId}-input`}>
              Message Ecomesta Support
            </label>
            <textarea
              id={`${titleId}-input`}
              ref={inputRef}
              rows={1}
              value={draft}
              maxLength={MAX_MESSAGE_CHARS}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Ask about Ecomesta…"
              className="max-h-32 min-h-[44px] flex-1 resize-none rounded-xl border border-[var(--color-border)] px-3 py-2.5 text-base text-[var(--color-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)] sm:text-sm"
            />
            <button
              type="submit"
              disabled={pending || !draft.trim()}
              aria-label="Send message"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] disabled:opacity-40"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5" aria-hidden="true">
                <path d="M5 12h13M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
          <p className="mt-1.5 text-[11px] text-[var(--color-muted)]">
            Never share passwords or payment details in this chat.
            {draft.length > MAX_MESSAGE_CHARS - 150 ? ` ${MAX_MESSAGE_CHARS - draft.length} characters left.` : ''}
          </p>
        </form>
      ) : null}
    </div>
  );
}
