'use client';

import type { FormEvent, ReactNode } from 'react';
import { Button } from '@ecomesta/ui';
import { Input } from './input';

/**
 * List-page filter card: a search box with a Search button, a row of labelled
 * filters underneath, and a footer with the result count and "Clear filters".
 */
export function FilterBar({
  onSubmit,
  search,
  children,
  summary,
  onReset,
}: {
  onSubmit: () => void;
  search: {
    value: string;
    onChange: (value: string) => void;
    /** Clears the box and the applied search. */
    onClear: () => void;
    placeholder: string;
    label: string;
  };
  /** `FilterField`s; laid out two per row on small screens, all in one row on large ones. */
  children?: ReactNode;
  summary?: ReactNode;
  /** Shown as "Clear filters" when given (pass it only while a filter is active). */
  onReset?: () => void;
}) {
  return (
    <form
      className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm sm:p-5"
      onSubmit={(event: FormEvent) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-muted)]"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" strokeLinecap="round" />
          </svg>
          <Input
            className="h-10 pl-9 pr-9"
            placeholder={search.placeholder}
            value={search.value}
            onChange={(e) => search.onChange(e.target.value)}
            aria-label={search.label}
          />
          {search.value ? (
            <button
              type="button"
              aria-label="Clear search"
              className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-[var(--color-muted)] hover:bg-[var(--color-bg)] hover:text-[var(--color-ink)]"
              onClick={search.onClear}
            >
              ×
            </button>
          ) : null}
        </div>
        <Button type="submit" className="h-10 sm:w-28">
          Search
        </Button>
      </div>

      {children ? (
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">{children}</div>
      ) : null}

      {summary !== undefined || onReset ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--color-border)] pt-3 text-sm">
          <p className="text-[var(--color-muted)]" aria-live="polite">
            {summary ?? ' '}
          </p>
          {onReset ? (
            <button
              type="button"
              className="font-medium text-[var(--color-accent)] hover:underline"
              onClick={onReset}
            >
              Clear filters
            </button>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}

/** A labelled control inside a `FilterBar`. */
export function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 space-y-1.5">
      <span className="block text-xs font-medium uppercase tracking-wide text-[var(--color-muted)]">
        {label}
      </span>
      {children}
    </div>
  );
}
