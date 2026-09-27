'use client';

import { useEffect, useState } from 'react';

/**
 * Read-only DNS value with a copy button. Merchants paste these into a
 * registrar UI, so the raw value stays selectable when the clipboard API is
 * unavailable (insecure origins, older browsers).
 */
export function CopyValue({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
      return;
    }
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard?.writeText(value);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted)]">
          {label}
        </span>
        {hint ? (
          <span className="text-xs text-[var(--color-muted)]">{hint}</span>
        ) : null}
      </div>
      <div className="flex items-center gap-2 rounded-md border border-[var(--color-border)] bg-[#f7faf9] px-3 py-2">
        <code className="min-w-0 flex-1 break-all font-mono text-xs text-[var(--color-ink)]">
          {value}
        </code>
        <button
          type="button"
          aria-label={`Copy ${label}`}
          onClick={() => void copy()}
          className="shrink-0 rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-xs font-medium text-[var(--color-ink)] hover:bg-[var(--color-bg)]"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  );
}
