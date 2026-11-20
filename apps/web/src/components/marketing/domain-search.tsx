'use client';

import { useState, type FormEvent } from 'react';
import { apiBaseUrl } from '@/lib/public-api';
import { merchantUrl } from '@/lib/marketing/site';

interface Result {
  domain: string;
  available: boolean;
  premium: boolean;
  priceBdt: number | null;
  renewBdt: number | null;
  error?: boolean;
}

const TEXT = {
  en: {
    short: 'Type a name of at least 2 letters.',
    failed: 'Could not search right now. Please try again.',
    label: 'Domain name',
    searching: 'Searching…',
    search: 'Search domain',
    unknown: 'Could not check right now',
    available: 'Available',
    renews: (p: string) => ` · renews at ${p}/year`,
    premium: 'Premium name — not sold here',
    taken: 'Already taken',
    perYear: '/year',
    buy: 'Buy',
  },
  bn: {
    short: 'অন্তত ২ অক্ষরের একটা নাম লিখুন।',
    failed: 'এখন খোঁজা যাচ্ছে না। একটু পরে আবার চেষ্টা করুন।',
    label: 'ডোমেইনের নাম',
    searching: 'খোঁজা হচ্ছে…',
    search: 'ডোমেইন খুঁজুন',
    unknown: 'এখন যাচাই করা যায়নি',
    available: 'পাওয়া যাচ্ছে',
    renews: (p: string) => ` · রিনিউ ${p}/বছর`,
    premium: 'প্রিমিয়াম নাম — এখানে বিক্রি হয় না',
    taken: 'আগেই নেওয়া হয়েছে',
    perYear: '/বছর',
    buy: 'কিনুন',
  },
};

function taka(amount: number) {
  return `৳${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(amount)}`;
}

/** Search a name on every offered extension; Buy continues in the merchant dashboard. */
export function DomainSearch({ locale = 'en' }: { locale?: 'en' | 'bn' }) {
  const t = TEXT[locale];
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Result[] | null>(null);

  async function search(event: FormEvent) {
    event.preventDefault();
    const q = query.trim();
    if (q.length < 2) {
      setError(t.short);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`${apiBaseUrl()}/public/domains/search?q=${encodeURIComponent(q)}`);
      const body = (await response.json().catch(() => null)) as {
        data?: { results: Result[] };
        error?: { message?: string };
      } | null;
      if (!response.ok || !body?.data) {
        setResults(null);
        setError(body?.error?.message ?? t.failed);
        return;
      }
      setResults(body.data.results);
    } catch {
      setResults(null);
      setError(t.failed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <form onSubmit={search} className="flex flex-col gap-3 sm:flex-row" role="search" aria-label="Domain search">
        <label htmlFor="domain-q" className="sr-only">
          {t.label}
        </label>
        <input
          id="domain-q"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="amarshop or amarshop.com"
          autoComplete="off"
          spellCheck={false}
          className="h-12 flex-1 rounded-xl border border-[var(--color-border)] bg-white px-4 text-base shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
        />
        <button
          type="submit"
          disabled={busy}
          data-cta="domain-search"
          className="h-12 rounded-xl bg-[var(--color-accent)] px-6 font-semibold text-white disabled:opacity-60"
        >
          {busy ? t.searching : t.search}
        </button>
      </form>
      {error ? (
        <p role="alert" className="mt-3 text-sm text-[#a3441f]">
          {error}
        </p>
      ) : null}
      {results ? (
        <ul aria-label="Search results" className="mt-6 divide-y divide-[var(--color-border)] overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white">
          {results.map((r) => (
            <li key={r.domain} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
              <div className="min-w-0">
                <p className="break-all font-mono text-base font-semibold">{r.domain}</p>
                <p className="text-sm text-[var(--color-muted)]">
                  {r.error
                    ? t.unknown
                    : r.available
                      ? `${t.available}${r.renewBdt ? t.renews(taka(r.renewBdt)) : ''}`
                      : r.premium
                        ? t.premium
                        : t.taken}
                </p>
              </div>
              {r.available && r.priceBdt ? (
                <div className="flex items-center gap-3">
                  <span className="font-semibold">{taka(r.priceBdt)}
                    {t.perYear}
                  </span>
                  <a
                    href={merchantUrl(`/dashboard/domains?buy=${encodeURIComponent(r.domain)}`)}
                    data-cta="domain-buy"
                    className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white"
                  >
                    {t.buy}
                  </a>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
