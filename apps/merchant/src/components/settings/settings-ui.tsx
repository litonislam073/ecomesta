'use client';

import type { ReactNode } from 'react';
import { Button } from '@ecomesta/ui';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';

export function SettingsHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div>
      <h1 className="text-2xl font-semibold">{title}</h1>
      {description ? (
        <p className="mt-1 text-sm text-[var(--color-muted)]">{description}</p>
      ) : null}
    </div>
  );
}

/** Shared store / loading / error states for a settings page. */
export function SettingsGate({
  storeId,
  loading,
  error,
  onRetry,
  children,
}: {
  storeId: string | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  children: ReactNode;
}) {
  if (!storeId) {
    return (
      <EmptyState
        title="Select a store"
        description="Choose a store to view its settings."
      />
    );
  }
  if (loading) return <LoadingState label="Loading settings…" />;
  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  return <>{children}</>;
}

export function ReadOnlyNotice() {
  return (
    <p
      role="note"
      className="rounded-md border border-[var(--color-border)] bg-[#f3f7f5] px-3 py-2 text-sm text-[var(--color-muted)]"
    >
      You have read-only access. Ask a store manager or the store owner to change
      these settings.
    </p>
  );
}

export function Field({
  id,
  label,
  hint,
  error,
  warning,
  counter,
  children,
}: {
  id: string;
  label: string;
  hint?: ReactNode;
  error?: string | null;
  warning?: string | null;
  counter?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1 text-sm">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="font-medium text-[var(--color-ink)]">
          {label}
        </label>
        {counter ? (
          <span className="text-xs tabular-nums text-[var(--color-muted)]">{counter}</span>
        ) : null}
      </div>
      {children}
      {hint ? <p className="text-xs text-[var(--color-muted)]">{hint}</p> : null}
      {warning ? (
        <p className="text-xs text-[#8a5a00]" data-testid={`${id}-warning`}>
          {warning}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-xs text-[var(--color-danger)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export const textareaClass =
  'w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] disabled:opacity-60';

export function ToggleRow({
  id,
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  description?: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 py-2">
      <input
        id={id}
        type="checkbox"
        className="mt-1 h-4 w-4"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <div className="text-sm">
        <label htmlFor={id} className="font-medium text-[var(--color-ink)]">
          {label}
        </label>
        {description ? (
          <p className="mt-0.5 text-[var(--color-muted)]">{description}</p>
        ) : null}
      </div>
    </div>
  );
}

export function ReadOnlyRow({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <div className="grid gap-1 py-2 text-sm sm:grid-cols-[12rem_1fr] sm:gap-4">
      <dt className="font-medium text-[var(--color-ink)]">{label}</dt>
      <dd>
        <div className="text-[var(--color-ink)]">{value}</div>
        {hint ? <p className="mt-0.5 text-xs text-[var(--color-muted)]">{hint}</p> : null}
      </dd>
    </div>
  );
}

export function SaveBar({
  saving,
  dirty,
  canEdit,
  onReset,
}: {
  saving: boolean;
  dirty: boolean;
  canEdit: boolean;
  onReset: () => void;
}) {
  if (!canEdit) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="submit" disabled={saving || !dirty}>
        {saving ? 'Saving…' : 'Save changes'}
      </Button>
      <Button type="button" variant="secondary" disabled={saving || !dirty} onClick={onReset}>
        Discard
      </Button>
      {dirty && !saving ? (
        <span className="text-xs text-[var(--color-muted)]">Unsaved changes</span>
      ) : null}
    </div>
  );
}
