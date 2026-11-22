'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { humanApiError } from '@/lib/admin-utils';
import { api } from '@/lib/api-client';

export type EntitySearchKind = 'tenant' | 'store' | 'user';

type Option = { id: string; label: string; hint?: string };

const ENDPOINTS: Record<EntitySearchKind, string> = {
  tenant: '/admin/tenants',
  store: '/admin/stores',
  user: '/admin/users',
};

function optionFromRow(kind: EntitySearchKind, row: Record<string, unknown>): Option | null {
  const id = typeof row.id === 'string' ? row.id : null;
  if (!id) return null;
  if (kind === 'user') {
    const email = typeof row.email === 'string' ? row.email : id;
    const name = [row.firstName, row.lastName].filter((part) => typeof part === 'string' && part).join(' ');
    return { id, label: email, hint: name || undefined };
  }
  const name = typeof row.name === 'string' ? row.name : id;
  const slug = typeof row.slug === 'string' ? row.slug : undefined;
  return { id, label: name, hint: slug };
}

/**
 * Searchable picker that resolves a tenant / store / user to a UUID for filters
 * that the API validates with `@IsUUID()`.
 */
export function EntitySearchSelect({
  kind,
  label,
  value,
  onChange,
  help,
}: {
  kind: EntitySearchKind;
  label: string;
  value: string;
  onChange: (id: string) => void;
  help?: string;
}) {
  const listId = useId();
  const [query, setQuery] = useState('');
  const [selectedLabel, setSelectedLabel] = useState('');
  const [options, setOptions] = useState<Option[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!value) {
      setSelectedLabel('');
      setQuery('');
    }
  }, [value]);

  const search = useCallback(
    async (term: string) => {
      const q = term.trim();
      if (q.length < 1) {
        setOptions([]);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const result = await api.get<{
          success: true;
          data: { items: Array<Record<string, unknown>> };
        }>(`${ENDPOINTS[kind]}?search=${encodeURIComponent(q)}&limit=10`);
        setOptions(
          result.data.items
            .map((row) => optionFromRow(kind, row))
            .filter((row): row is Option => Boolean(row)),
        );
      } catch (err) {
        setOptions([]);
        setError(humanApiError(err, 'Search failed'));
      } finally {
        setLoading(false);
      }
    },
    [kind],
  );

  useEffect(() => {
    if (!open) return;
    const handle = setTimeout(() => {
      void search(query);
    }, 250);
    return () => clearTimeout(handle);
  }, [open, query, search]);

  function pick(option: Option) {
    onChange(option.id);
    setSelectedLabel(option.label);
    setQuery(option.label);
    setOpen(false);
  }

  function clear() {
    onChange('');
    setSelectedLabel('');
    setQuery('');
    setOptions([]);
    setError(null);
  }

  return (
    <div className="space-y-1.5">
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">{label}</span>
        <div className="relative">
          <Input
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            placeholder={`Search ${kind}s…`}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
              if (value) onChange('');
              setSelectedLabel('');
            }}
            onFocus={() => {
              if (blurTimer.current) clearTimeout(blurTimer.current);
              setOpen(true);
            }}
            onBlur={() => {
              blurTimer.current = setTimeout(() => setOpen(false), 150);
            }}
          />
          {open ? (
            <ul
              id={listId}
              role="listbox"
              className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-md border border-[var(--color-border)] bg-white py-1 shadow-lg"
            >
              {loading ? (
                <li className="px-3 py-2 text-sm text-[var(--color-muted)]">Searching…</li>
              ) : null}
              {!loading && error ? (
                <li className="px-3 py-2 text-sm text-[var(--color-danger)]">{error}</li>
              ) : null}
              {!loading && !error && query.trim() && options.length === 0 ? (
                <li className="px-3 py-2 text-sm text-[var(--color-muted)]">No matches</li>
              ) : null}
              {options.map((option) => (
                <li key={option.id} role="option" aria-selected={option.id === value}>
                  <button
                    type="button"
                    className="flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-[#f3f7f5]"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(option)}
                  >
                    <span className="font-medium">{option.label}</span>
                    {option.hint ? (
                      <span className="text-xs text-[var(--color-muted)]">{option.hint}</span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </label>
      {value ? (
        <p className="flex flex-wrap items-center gap-2 text-xs text-[var(--color-muted)]">
          <span>
            Selected{selectedLabel ? `: ${selectedLabel}` : ''}{' '}
            <span className="font-mono">({value.slice(0, 8)}…)</span>
          </span>
          <button type="button" className="text-[var(--color-accent)] hover:underline" onClick={clear}>
            Clear
          </button>
        </p>
      ) : help ? (
        <p className="text-xs text-[var(--color-muted)]">{help}</p>
      ) : null}
    </div>
  );
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value.trim());
}
