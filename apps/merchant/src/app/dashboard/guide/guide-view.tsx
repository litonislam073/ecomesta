'use client';

import Link from 'next/link';
import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react';
import { GUIDE_GROUPS, GUIDE_SECTIONS, type GuideSection } from '@/lib/guide-content';
import { GUIDE_GROUPS_EN, GUIDE_SECTIONS_EN } from '@/lib/guide-content-en';

type GuideLocale = 'bn' | 'en';
const LOCALE_KEY = 'ecomesta.guide.locale';

const GUIDES = {
  bn: {
    groups: GUIDE_GROUPS as readonly string[],
    sections: GUIDE_SECTIONS,
    heading: 'Ecomesta স্টোর গাইড',
    intro:
      'স্টোর সেটআপ থেকে প্রোডাক্ট, থিম কাস্টমাইজ, ডেলিভারি, পেমেন্ট, অর্ডার আর মার্কেটিং — ড্যাশবোর্ডের প্রতিটি কাজ ধাপে ধাপে। হাইলাইট করা লেখাগুলো ড্যাশবোর্ডের বাটন বা মেনুর নাম।',
    searchLabel: 'গাইডে খুঁজুন',
    searchPlaceholder: 'খুঁজুন: থিম, কুরিয়ার, bKash, coupon…',
    tips: 'টিপস',
    open: (label: string) => `${label} খুলুন`,
    noResults: (q: string) => `“${q}” দিয়ে কিছু পাওয়া যায়নি। অন্য শব্দে খুঁজুন, বা `,
    noResultsEnd: '-এ আমাদের জানান।',
  },
  en: {
    groups: GUIDE_GROUPS_EN as readonly string[],
    sections: GUIDE_SECTIONS_EN,
    heading: 'Ecomesta store guide',
    intro:
      'Everything in the dashboard, step by step: store setup, products, theme customization, delivery, payments, orders and marketing. Highlighted words are the names of dashboard buttons and menus.',
    searchLabel: 'Search the guide',
    searchPlaceholder: 'Search: theme, courier, bKash, coupon…',
    tips: 'Tips',
    open: (label: string) => `Open ${label}`,
    noResults: (q: string) => `Nothing matches “${q}”. Try another word, or tell us in `,
    noResultsEnd: '.',
  },
};
type GuideCopy = (typeof GUIDES)[GuideLocale];

/** Renders **label** as a highlighted dashboard label. */
function rich(text: string): ReactNode {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <strong
        key={index}
        className="rounded bg-[var(--color-bg)] px-1 py-0.5 font-semibold text-[var(--color-ink)]"
      >
        {part.slice(2, -2)}
      </strong>
    ) : (
      <Fragment key={index}>{part}</Fragment>
    ),
  );
}

function sectionText(section: GuideSection): string {
  return [
    section.title,
    section.summary,
    section.plan ?? '',
    ...(section.steps ?? []),
    ...(section.points ?? []),
    ...(section.tips ?? []),
  ]
    .join(' ')
    .replace(/\*\*/g, '')
    .toLowerCase();
}

function GuideArticle({ section, number, copy }: { section: GuideSection; number: number; copy: GuideCopy }) {
  return (
    <article
      id={section.id}
      aria-labelledby={`${section.id}-title`}
      className="scroll-mt-24 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 id={`${section.id}-title`} className="text-lg font-semibold text-[var(--color-ink)]">
          <span className="mr-2 text-[var(--color-muted)]">{number}.</span>
          {section.title}
        </h2>
        {section.plan ? (
          <span className="rounded-full bg-[#eef6f1] px-2.5 py-1 text-xs font-medium text-[#1f6f4a]">
            {section.plan}
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">{section.summary}</p>

      {section.steps?.length ? (
        <ol className="mt-4 space-y-2.5">
          {section.steps.map((step, index) => (
            <li key={index} className="flex gap-3 text-sm leading-6">
              <span
                aria-hidden="true"
                className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)] text-xs font-semibold text-white"
              >
                {index + 1}
              </span>
              <span>{rich(step)}</span>
            </li>
          ))}
        </ol>
      ) : null}

      {section.points?.length ? (
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-6">
          {section.points.map((point, index) => (
            <li key={index}>{rich(point)}</li>
          ))}
        </ul>
      ) : null}

      {section.tips?.length ? (
        <div className="mt-4 rounded-md border border-[#f1e2b3] bg-[#fffaeb] px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#8a6100]">{copy.tips}</p>
          <ul className="mt-1.5 space-y-1.5 text-sm leading-6 text-[#5c4300]">
            {section.tips.map((tip, index) => (
              <li key={index}>• {rich(tip)}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {section.links?.length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {section.links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="inline-flex items-center gap-1 rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm font-medium text-[var(--color-accent)] hover:bg-[var(--color-bg)]"
            >
              {copy.open(link.label)} <span aria-hidden="true">→</span>
            </Link>
          ))}
        </div>
      ) : null}
    </article>
  );
}

export default function GuideView() {
  const [locale, setLocale] = useState<GuideLocale>('bn');
  const [query, setQuery] = useState('');
  const needle = query.trim().toLowerCase();
  const copy = GUIDES[locale];

  useEffect(() => {
    try {
      if (window.localStorage.getItem(LOCALE_KEY) === 'en') setLocale('en');
    } catch {
      // storage blocked: stay on Bangla
    }
  }, []);

  function chooseLocale(next: GuideLocale) {
    setLocale(next);
    try {
      window.localStorage.setItem(LOCALE_KEY, next);
    } catch {
      // storage blocked: the choice lasts for this visit
    }
  }

  const numbered = useMemo(
    () => copy.sections.map((section, index) => ({ section, number: index + 1 })),
    [copy],
  );
  const visible = useMemo(
    () => (needle ? numbered.filter(({ section }) => sectionText(section).includes(needle)) : numbered),
    [needle, numbered],
  );

  return (
    <div className="mx-auto max-w-6xl">
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-accent)]">Store guide</p>
            <h1 className="mt-1 text-2xl font-semibold" lang={locale}>{copy.heading}</h1>
          </div>
          <div role="group" aria-label="Guide language" className="inline-flex rounded-md border border-[var(--color-border)] p-0.5">
            {(['bn', 'en'] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={locale === value}
                onClick={() => chooseLocale(value)}
                className={`rounded px-3 py-1.5 text-sm font-medium ${
                  locale === value
                    ? 'bg-[var(--color-accent)] text-white'
                    : 'text-[var(--color-ink)] hover:bg-[var(--color-bg)]'
                }`}
              >
                {value === 'bn' ? 'বাংলা' : 'English'}
              </button>
            ))}
          </div>
        </div>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--color-muted)]">{copy.intro}</p>
        <label className="mt-4 block max-w-md">
          <span className="sr-only">{copy.searchLabel}</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={copy.searchPlaceholder}
            className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
          />
        </label>
      </div>

      <div lang={locale} className="mt-6 grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <nav aria-label="Guide contents" className="hidden lg:block">
          <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pr-2">
            {copy.groups.map((group) => {
              const items = visible.filter(({ section }) => section.group === group);
              if (!items.length) return null;
              return (
                <div key={group} className="mb-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">{group}</p>
                  <ul className="mt-1.5 space-y-1">
                    {items.map(({ section, number }) => (
                      <li key={section.id}>
                        <a
                          href={`#${section.id}`}
                          className="block rounded px-2 py-1 text-sm text-[var(--color-ink)] hover:bg-[var(--color-bg)]"
                        >
                          {number}. {section.title}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </nav>

        <div className="min-w-0 space-y-8">
          {visible.length === 0 ? (
            <p className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-sm text-[var(--color-muted)]">
              {copy.noResults(query)}
              <Link href="/dashboard/support" className="font-medium text-[var(--color-accent)] underline">
                Help & support
              </Link>
              {copy.noResultsEnd}
            </p>
          ) : null}
          {copy.groups.map((group) => {
            const items = visible.filter(({ section }) => section.group === group);
            if (!items.length) return null;
            return (
              <section key={group} aria-label={group}>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">{group}</h2>
                <div className="space-y-4">
                  {items.map(({ section, number }) => (
                    <GuideArticle key={section.id} section={section} number={number} copy={copy} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
