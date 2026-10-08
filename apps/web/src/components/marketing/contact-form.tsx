'use client';

import { useId, useRef, useState, type FormEvent } from 'react';
import { MARKETING_FOCUS } from '@ecomesta/ui/marketing';
import { requestHumanSupport, visitorDetailsErrors } from '@/lib/ai-support';

/** Topics the team sorts requests by; sent as the request's reason. */
export const CONTACT_TOPICS = [
  'Plans and pricing',
  'Getting started',
  'Payments and billing',
  'Delivery and couriers',
  'Technical help',
  'Partnership',
  'Something else',
] as const;

const MESSAGE_MIN = 10;
const MESSAGE_MAX = 2000;

type Field = 'name' | 'phone' | 'email' | 'message';

const fieldClass = (bad: boolean) =>
  `mt-1.5 block w-full rounded-lg border bg-white px-3.5 text-base text-[var(--color-ink)] placeholder:text-[#94a3b8] ${MARKETING_FOCUS} ${
    bad ? 'border-[#d9534f]' : 'border-[var(--color-border)]'
  }`;
// The asterisk is drawn by CSS so it never becomes part of the field's name.
const required = "after:ml-0.5 after:text-[#c0392b] after:content-['*']";

/**
 * Public contact form. Requests reach the Ecomesta team by email through the
 * same rate-limited endpoint as the support chat's "talk to a person" form.
 */
export function ContactForm() {
  const id = useId();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [topic, setTopic] = useState<string>(CONTACT_TOPICS[0]);
  const [message, setMessage] = useState('');
  const [website, setWebsite] = useState('');
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<{ reference: string; name: string; phone: string; email: string } | null>(null);
  const refs = {
    name: useRef<HTMLInputElement>(null),
    phone: useRef<HTMLInputElement>(null),
    email: useRef<HTMLInputElement>(null),
    message: useRef<HTMLTextAreaElement>(null),
  };
  const doneRef = useRef<HTMLHeadingElement>(null);

  function check(): Partial<Record<Field, string>> {
    const found: Partial<Record<Field, string>> = { ...visitorDetailsErrors({ name, phone, email }) };
    const text = message.trim();
    if (!text) found.message = 'Please write your message.';
    else if (text.length < MESSAGE_MIN) found.message = `Please write at least ${MESSAGE_MIN} characters.`;
    return found;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError(null);
    const found = check();
    setErrors(found);
    const first = (['name', 'phone', 'email', 'message'] as Field[]).find((field) => found[field]);
    if (first) {
      refs[first].current?.focus();
      return;
    }
    setBusy(true);
    const result = await requestHumanSupport({
      name: name.trim(),
      phone,
      email,
      message: message.trim(),
      reason: topic,
      transcript: [],
      website,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setSent({ reference: result.reference, name: name.trim(), phone: phone.trim(), email: email.trim() });
    window.setTimeout(() => doneRef.current?.focus(), 0);
  }

  function startOver() {
    setSent(null);
    setMessage('');
    setTopic(CONTACT_TOPICS[0]);
    setErrors({});
    setError(null);
  }

  if (sent) {
    return (
      <div role="status" className="rounded-xl bg-[#eef7f2] p-6 text-[var(--color-ink)]">
        <span
          aria-hidden="true"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-accent)] text-lg text-white"
        >
          ✓
        </span>
        <h3 ref={doneRef} tabIndex={-1} className="mt-4 text-xl font-semibold focus:outline-none">
          Thank you, {sent.name}! Your message has reached our team.
        </h3>
        <p className="mt-2 text-[var(--color-muted)]">
          We will call you on <strong className="text-[var(--color-ink)]">{sent.phone}</strong>
          {sent.email ? (
            <>
              {' '}
              or email <strong className="break-all text-[var(--color-ink)]">{sent.email}</strong>
            </>
          ) : null}
          .
        </p>
        <p className="mt-4 text-sm">
          Your reference: <span className="font-mono font-semibold">{sent.reference}</span>
        </p>
        <button
          type="button"
          onClick={startOver}
          className={`mt-5 rounded-sm text-sm font-semibold text-[var(--color-accent)] underline-offset-4 hover:underline ${MARKETING_FOCUS}`}
        >
          Send another message
        </button>
      </div>
    );
  }

  const describe = (field: Field) => (errors[field] ? `${id}-${field}-error` : undefined);
  const fieldError = (field: Field) =>
    errors[field] ? (
      <p id={`${id}-${field}-error`} className="mt-1.5 text-sm text-[#b42318]">
        {errors[field]}
      </p>
    ) : null;
  const clear = (field: Field) => errors[field] && setErrors((prev) => ({ ...prev, [field]: undefined }));

  return (
    <form onSubmit={onSubmit} noValidate aria-label="Contact form" className="relative space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
        <label className="block text-sm font-medium text-[var(--color-ink)]">
          <span className={required}>Your name</span>
          <input
            ref={refs.name}
            className={`${fieldClass(Boolean(errors.name))} h-12`}
            autoComplete="name"
            required
            maxLength={100}
            value={name}
            aria-invalid={Boolean(errors.name) || undefined}
            aria-describedby={describe('name')}
            onChange={(e) => {
              setName(e.target.value);
              clear('name');
            }}
          />
        </label>
          {fieldError('name')}
        </div>
        <div>
        <label className="block text-sm font-medium text-[var(--color-ink)]">
          <span className={required}>Phone number</span>
          <input
            ref={refs.phone}
            className={`${fieldClass(Boolean(errors.phone))} h-12`}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="01XXXXXXXXX"
            required
            maxLength={20}
            value={phone}
            aria-invalid={Boolean(errors.phone) || undefined}
            aria-describedby={describe('phone')}
            onChange={(e) => {
              setPhone(e.target.value);
              clear('phone');
            }}
          />
        </label>
          {fieldError('phone')}
        </div>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
        <label className="block text-sm font-medium text-[var(--color-ink)]">
          Email <span className="font-normal text-[var(--color-muted)]">(optional)</span>
          <input
            ref={refs.email}
            className={`${fieldClass(Boolean(errors.email))} h-12`}
            type="email"
            inputMode="email"
            autoComplete="email"
            maxLength={200}
            value={email}
            aria-invalid={Boolean(errors.email) || undefined}
            aria-describedby={describe('email')}
            onChange={(e) => {
              setEmail(e.target.value);
              clear('email');
            }}
          />
        </label>
          {fieldError('email')}
        </div>
        <label className="block text-sm font-medium text-[var(--color-ink)]">
          Topic
          <select className={`${fieldClass(false)} h-12`} value={topic} onChange={(e) => setTopic(e.target.value)}>
            {CONTACT_TOPICS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div>
      <label className="block text-sm font-medium text-[var(--color-ink)]">
        <span className={required}>How can we help?</span>
        <textarea
          ref={refs.message}
          className={`${fieldClass(Boolean(errors.message))} min-h-36 resize-y py-3`}
          required
          maxLength={MESSAGE_MAX}
          placeholder="Tell us about your business and what you need."
          value={message}
          aria-invalid={Boolean(errors.message) || undefined}
          aria-describedby={[describe('message'), `${id}-count`].filter(Boolean).join(' ')}
          onChange={(e) => {
            setMessage(e.target.value);
            clear('message');
          }}
        />
      </label>
      <div className="flex items-start justify-between gap-3">
        <div>{fieldError('message')}</div>
        <p id={`${id}-count`} className="mt-1.5 shrink-0 text-xs text-[var(--color-muted)]">
          {message.length}/{MESSAGE_MAX}
        </p>
      </div>
      </div>
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
        <p role="alert" className="rounded-lg border border-[#f1c9b8] bg-[#fdf3ee] px-4 py-3 text-sm text-[#a3441f]">
          {error}
        </p>
      ) : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-[var(--color-muted)]">
          Fields marked <span className="text-[#c0392b]">*</span> are required.
        </p>
        <button
          type="submit"
          disabled={busy}
          className={`inline-flex h-12 items-center justify-center rounded-xl bg-[var(--color-accent)] px-7 text-base font-semibold text-white shadow-sm hover:bg-[var(--color-accent-hover)] disabled:cursor-not-allowed disabled:opacity-60 ${MARKETING_FOCUS}`}
        >
          {busy ? 'Sending…' : 'Send message'}
        </button>
      </div>
    </form>
  );
}
