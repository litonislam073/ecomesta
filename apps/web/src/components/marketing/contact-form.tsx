'use client';

import { useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { MARKETING_FOCUS, type MarketingLocale } from '@ecomesta/ui/marketing';
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

/** Bangla labels for the topics; the English value is what the team receives. */
const TOPIC_LABELS_BN: Record<(typeof CONTACT_TOPICS)[number], string> = {
  'Plans and pricing': 'প্যাকেজ ও দাম',
  'Getting started': 'শুরু করা',
  'Payments and billing': 'পেমেন্ট ও বিলিং',
  'Delivery and couriers': 'ডেলিভারি ও কুরিয়ার',
  'Technical help': 'কারিগরি সাহায্য',
  Partnership: 'পার্টনারশিপ',
  'Something else': 'অন্য কিছু',
};

const FORM_COPY = {
  en: {
    form: 'Contact form',
    name: 'Your name',
    phone: 'Phone number',
    email: 'Email',
    topic: 'Topic',
    message: 'How can we help?',
    messagePlaceholder: 'Tell us about your business and what you need.',
    required: (star: ReactNode) => <>Fields marked {star} are required.</>,
    send: 'Send message',
    sending: 'Sending…',
    writeMessage: 'Please write your message.',
    minLength: (min: number) => `Please write at least ${min} characters.`,
    fieldErrors: null as null | Partial<Record<'name' | 'phone' | 'email', string>>,    thanks: (name: string) => `Thank you, ${name}! Your message has reached our team.`,
    thanksPending: (name: string) => `Thank you, ${name}! Passing your message to our team…`,
    callYou: 'We will call you on',
    orEmail: 'or email',
    reference: 'Your reference:',
    another: 'Send another message',
  },
  bn: {
    form: 'যোগাযোগ ফর্ম',
    name: 'আপনার নাম',
    phone: 'মোবাইল নম্বর',
    email: 'ইমেইল',
    topic: 'বিষয়',
    message: 'কীভাবে সাহায্য করতে পারি?',
    messagePlaceholder: 'আপনার ব্যবসা আর কী দরকার, লিখুন।',
    required: (star: ReactNode) => <>{star} চিহ্নিত ঘরগুলো পূরণ করতে হবে।</>,
    send: 'মেসেজ পাঠান',
    sending: 'পাঠানো হচ্ছে…',
    writeMessage: 'আপনার মেসেজ লিখুন।',
    minLength: (min: number) => `অন্তত ${min.toLocaleString('bn-BD')} অক্ষর লিখুন।`,
    fieldErrors: {
      name: 'আপনার নাম লিখুন।',
      phone: 'সঠিক মোবাইল নম্বর দিন (যেমন 01XXXXXXXXX)।',
      email: 'সঠিক ইমেইল ঠিকানা দিন।',
    } as null | Partial<Record<'name' | 'phone' | 'email', string>>,
    thanks: (name: string) => `ধন্যবাদ, ${name}! আপনার মেসেজ আমাদের টিমের কাছে পৌঁছেছে।`,
    thanksPending: (name: string) => `ধন্যবাদ, ${name}! আপনার মেসেজ আমাদের টিমের কাছে পাঠানো হচ্ছে…`,
    callYou: 'আমরা কল করব এই নম্বরে:',
    orEmail: 'অথবা ইমেইল করব',
    reference: 'আপনার রেফারেন্স:',
    another: 'আরেকটি মেসেজ পাঠান',
  },
};

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
export function ContactForm({ locale = 'en' }: { locale?: MarketingLocale }) {
  const copy = FORM_COPY[locale];
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
  // `reference` is null while the handoff ACK is still on its way (optimistic success).
  const [sent, setSent] = useState<{ reference: string | null; name: string; phone: string; email: string } | null>(null);
  const refs = {
    name: useRef<HTMLInputElement>(null),
    phone: useRef<HTMLInputElement>(null),
    email: useRef<HTMLInputElement>(null),
    message: useRef<HTMLTextAreaElement>(null),
  };
  const doneRef = useRef<HTMLHeadingElement>(null);

  function check(): Partial<Record<Field, string>> {
    const found: Partial<Record<Field, string>> = { ...visitorDetailsErrors({ name, phone, email }, { requireEmail: true }) };
    if (copy.fieldErrors) {
      for (const field of ['name', 'phone', 'email'] as const) {
        if (found[field]) found[field] = copy.fieldErrors[field];
      }
    }
    const text = message.trim();
    if (!text) found.message = copy.writeMessage;
    else if (text.length < MESSAGE_MIN) found.message = copy.minLength(MESSAGE_MIN);
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
    // The server answers as soon as the request is queued for the team (it does not
    // wait for the email to be delivered), so show success right away and only fall
    // back to the form — with everything still typed — if the handoff is refused.
    const visitor = { name: name.trim(), phone: phone.trim(), email: email.trim() };
    setSent({ reference: null, ...visitor });
    window.setTimeout(() => doneRef.current?.focus(), 0);
    const result = await requestHumanSupport({
      name: visitor.name,
      phone,
      email,
      message: message.trim(),
      reason: topic,
      transcript: [],
      website,
    });
    setBusy(false);
    if (!result.ok) {
      setSent(null);
      setError(result.message);
      window.setTimeout(() => refs.message.current?.focus(), 0);
      return;
    }
    setSent({ reference: result.reference, ...visitor });
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
          {sent.reference ? copy.thanks(sent.name) : copy.thanksPending(sent.name)}
        </h3>
        <p className="mt-2 text-[var(--color-muted)]">
          {copy.callYou} <strong className="text-[var(--color-ink)]">{sent.phone}</strong>
          {sent.email ? (
            <>
              {' '}
              {copy.orEmail} <strong className="break-all text-[var(--color-ink)]">{sent.email}</strong>
            </>
          ) : null}
          .
        </p>
        {sent.reference ? (
          <>
            <p className="mt-4 text-sm">
              {copy.reference} <span className="font-mono font-semibold">{sent.reference}</span>
            </p>
            <button
              type="button"
              onClick={startOver}
              className={`mt-5 rounded-sm text-sm font-semibold text-[var(--color-accent)] underline-offset-4 hover:underline ${MARKETING_FOCUS}`}
            >
              {copy.another}
            </button>
          </>
        ) : null}
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
    <form onSubmit={onSubmit} noValidate aria-label={copy.form} className="relative space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
        <label className="block text-sm font-medium text-[var(--color-ink)]">
          <span className={required}>{copy.name}</span>
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
          <span className={required}>{copy.phone}</span>
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
          <span className={required}>{copy.email}</span>
          <input
            ref={refs.email}
            className={`${fieldClass(Boolean(errors.email))} h-12`}
            type="email"
            inputMode="email"
            autoComplete="email"
            required
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
          {copy.topic}
          <select className={`${fieldClass(false)} h-12`} value={topic} onChange={(e) => setTopic(e.target.value)}>
            {CONTACT_TOPICS.map((item) => (
              <option key={item} value={item}>
                {locale === 'bn' ? TOPIC_LABELS_BN[item] : item}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div>
      <label className="block text-sm font-medium text-[var(--color-ink)]">
        <span className={required}>{copy.message}</span>
        <textarea
          ref={refs.message}
          className={`${fieldClass(Boolean(errors.message))} min-h-36 resize-y py-3`}
          required
          maxLength={MESSAGE_MAX}
          placeholder={copy.messagePlaceholder}
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
      <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden opacity-0">
        <input
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          data-honeypot="true"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
      </div>
      {error ? (
        <p role="alert" className="rounded-lg border border-[#f1c9b8] bg-[#fdf3ee] px-4 py-3 text-sm text-[#a3441f]">
          {error}
        </p>
      ) : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-[var(--color-muted)]">
          {copy.required(<span className="text-[#c0392b]">*</span>)}
        </p>
        <button
          type="submit"
          disabled={busy}
          className={`inline-flex h-12 items-center justify-center rounded-xl bg-[var(--color-accent)] px-7 text-base font-semibold text-white shadow-sm hover:bg-[var(--color-accent-hover)] disabled:cursor-not-allowed disabled:opacity-60 ${MARKETING_FOCUS}`}
        >
          {busy ? copy.sending : copy.send}
        </button>
      </div>
    </form>
  );
}
