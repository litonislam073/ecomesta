import type { ReactNode } from 'react';
import { MarketingLogo, marketingHref } from '@ecomesta/ui/marketing';
import { marketingSiteUrl } from '@/lib/marketing-site';

const LINK_CLASSES =
  'rounded-sm underline-offset-4 hover:text-[var(--color-ink)] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]';

/** Signed-in setup chrome: brand header and compact footer, no marketing navigation. */
export function OnboardingShell({ children }: { children: ReactNode }) {
  const site = marketingSiteUrl();
  return (
    <div className="flex min-h-screen flex-col overflow-x-clip bg-[#fbfaf7] text-[var(--color-ink)]">
      <header className="border-b border-[var(--color-border)] bg-white/90">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:shadow"
        >
          Skip to content
        </a>
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <MarketingLogo href={marketingHref(site, '/')} />
          <a href={marketingHref(site, '/contact')} className={`text-sm font-medium text-[var(--color-muted)] ${LINK_CLASSES}`}>
            Need help?
          </a>
        </div>
      </header>
      <main id="main-content" className="flex-1">
        {children}
      </main>
      <footer className="border-t border-[var(--color-border)] bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-sm text-[var(--color-muted)] sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>© {new Date().getFullYear()} Ecomesta · Built for selling in Bangladesh</p>
          <nav aria-label="Help" className="flex gap-4">
            <a href={marketingHref(site, '/faq')} className={LINK_CLASSES}>
              FAQ
            </a>
            <a href={marketingHref(site, '/contact')} className={LINK_CLASSES}>
              Contact
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}

function DoneMark() {
  return (
    <span
      aria-hidden="true"
      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)] text-white"
    >
      <svg viewBox="0 0 20 20" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 10.5l4 4 8-9" />
      </svg>
    </span>
  );
}

/**
 * Three-step progress: account (done), store details, payment. Payment is the
 * last step; the store is created when it is submitted. Steps are not links.
 */
export function SetupProgress({ current = 'store' }: { current?: 'store' | 'payment' }) {
  const steps = [
    { key: 'account', label: 'Account' },
    { key: 'store', label: 'Store details' },
    { key: 'payment', label: 'Payment' },
  ] as const;
  const currentIndex = steps.findIndex((step) => step.key === current);
  return (
    <ol aria-label="Setup progress" className="grid grid-cols-3 gap-2 text-sm">
      {steps.map((step, index) => {
        const done = index < currentIndex;
        const active = index === currentIndex;
        return (
          <li
            key={step.key}
            aria-current={active ? 'step' : undefined}
            className={`flex items-center gap-2 border-t-2 pt-2 ${
              done || active ? 'border-[var(--color-accent)]' : 'border-[var(--color-border)]'
            } ${active ? 'font-semibold text-[var(--color-ink)]' : 'text-[var(--color-muted)]'}`}
          >
            {done ? (
              <DoneMark />
            ) : (
              <span
                aria-hidden="true"
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-bold ${
                  active ? 'border-[var(--color-accent)] text-[var(--color-accent)]' : 'border-[var(--color-border)]'
                }`}
              >
                {index + 1}
              </span>
            )}
            <span>
              {step.label}
              {done ? <span className="sr-only"> (completed)</span> : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
