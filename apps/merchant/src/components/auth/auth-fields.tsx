'use client';

import { useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { Input } from '@/components/ui/input';

const INPUT_CLASSES =
  'h-11 rounded-lg px-3.5 text-base aria-[invalid=true]:border-[var(--color-danger)] aria-[invalid=true]:focus-visible:outline-[var(--color-danger)]';

type FieldInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> & {
  id: string;
  label: string;
  error?: string | null;
  hint?: ReactNode;
};

function describedBy(id: string, error?: string | null, hint?: ReactNode) {
  const ids = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean);
  return ids.length ? ids.join(' ') : undefined;
}

function FieldMessages({ id, error, hint }: { id: string; error?: string | null; hint?: ReactNode }) {
  return (
    <>
      {hint ? (
        <div id={`${id}-hint`} className="text-sm text-[var(--color-muted)]">
          {hint}
        </div>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-sm font-medium text-[var(--color-danger)]">
          {error}
        </p>
      ) : null}
    </>
  );
}

export function AuthField({ id, label, error, hint, className = '', ...props }: FieldInputProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-semibold text-[var(--color-ink)]">
        {label}
      </label>
      <Input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint)}
        className={`${INPUT_CLASSES} ${className}`}
        {...props}
      />
      <FieldMessages id={id} error={error} hint={hint} />
    </div>
  );
}

export function PasswordField({ id, label, error, hint, className = '', ...props }: FieldInputProps) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-semibold text-[var(--color-ink)]">
        {label}
      </label>
      <div className="relative">
        <Input
          id={id}
          type={visible ? 'text' : 'password'}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, error, hint)}
          className={`${INPUT_CLASSES} pr-12 ${className}`}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((value) => !value)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-controls={id}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-[var(--color-muted)] hover:text-[var(--color-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-accent)]"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12z" />
            <circle cx="12" cy="12" r="2.75" />
            {visible ? <path d="M4 4l16 16" /> : null}
          </svg>
        </button>
      </div>
      <FieldMessages id={id} error={error} hint={hint} />
    </div>
  );
}

export function FormAlert({
  title,
  message,
  details,
}: {
  title?: string;
  message: string;
  details?: string[];
}) {
  return (
    <div
      role="alert"
      className="rounded-lg border border-[#f3c9c4] bg-[#fdf3f2] px-4 py-3 text-sm text-[var(--color-danger)]"
    >
      {title ? <p className="font-semibold">{title}</p> : null}
      <p className={title ? 'mt-0.5' : 'font-medium'}>{message}</p>
      {details && details.length > 0 ? (
        <ul className="mt-1 list-disc space-y-0.5 pl-5">
          {details.map((detail) => (
            <li key={detail}>{detail}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function SecureNote() {
  return (
    <p className="flex items-center justify-center gap-2 text-xs text-[var(--color-muted)]">
      <svg aria-hidden="true" viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="9" width="12" height="8" rx="1.5" />
        <path d="M7 9V6.5a3 3 0 016 0V9" />
      </svg>
      Your account is protected with secure authentication.
    </p>
  );
}
