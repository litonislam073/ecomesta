'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '@ecomesta/ui';
import { Input } from '@/components/ui/input';

export function AddDomainForm({
  busy,
  onSubmit,
}: {
  busy: boolean;
  onSubmit: (hostname: string) => Promise<boolean>;
}) {
  const [hostname, setHostname] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const value = hostname.trim();
    if (busy) {
      return;
    }
    if (!value) {
      setError('Hostname is required');
      return;
    }
    setError(null);
    const ok = await onSubmit(value);
    if (ok) {
      setHostname('');
      setError(null);
    }
  }

  return (
    <form
      onSubmit={submit}
      aria-label="Add custom domain"
      className="space-y-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
      noValidate
    >
      <div>
        <h2 className="text-base font-semibold">Add a custom domain</h2>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Enter the hostname shoppers will use. Protocol, path and port are
          stripped automatically.
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-[16rem] flex-1 space-y-1 text-sm">
          <span>Hostname</span>
          <Input
            name="hostname"
            value={hostname}
            placeholder="shop.example.com"
            autoComplete="off"
            spellCheck={false}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'hostname-error' : undefined}
            onChange={(event) => {
              setHostname(event.target.value);
              if (error) setError(null);
            }}
          />
          {error ? (
            <p id="hostname-error" role="alert" className="text-xs text-[var(--color-danger)]">
              {error}
            </p>
          ) : null}
        </label>
        <Button type="submit" disabled={busy}>
          {busy ? 'Adding…' : 'Add domain'}
        </Button>
      </div>
    </form>
  );
}
