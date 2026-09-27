import Link from 'next/link';
import type { ReactNode } from 'react';
import { MarketingHeaderFrame } from './header-frame';
import { MobileNav } from './mobile-nav';
import { FOOTER_NAV, PRIMARY_NAV, marketingHref } from './nav';
import { ButtonLink } from './primitives';

export interface MarketingLinks {
  /** Origin of the marketing site; '' when rendered by the marketing site itself. */
  siteOrigin: string;
  loginHref: string;
  registerHref: string;
}

/** Marks the header/footer link for the page being viewed (merchant auth pages). */
export type MarketingCurrentPage = 'login' | 'register';

/** Served from each app's `public/brand`; `onDark` swaps the navy wordmark for white. */
export function MarketingLogo({
  href = '/',
  onDark = false,
}: {
  href?: string;
  onDark?: boolean;
}) {
  return (
    <Link
      href={href}
      className="flex shrink-0 items-center rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--color-accent)]"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={onDark ? '/brand/ecomesta-logo-on-dark.png' : '/brand/ecomesta-logo.png'}
        alt="Ecomesta"
        width={504}
        height={96}
        className="h-8 w-auto sm:h-9"
      />
    </Link>
  );
}

export function MarketingHeader({
  siteOrigin,
  loginHref,
  registerHref,
  current,
}: MarketingLinks & { current?: MarketingCurrentPage }) {
  const primary = PRIMARY_NAV.map((item) => ({
    ...item,
    href: marketingHref(siteOrigin, item.href),
  }));

  return (
    <MarketingHeaderFrame>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:shadow"
      >
        Skip to content
      </a>
      <div className="relative mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <MarketingLogo href={marketingHref(siteOrigin, '/')} />
        <nav aria-label="Primary" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {primary.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="rounded-md px-3 py-2 text-[15px] font-medium text-[var(--color-muted)] transition-colors hover:text-[var(--color-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex items-center gap-2">
          <a
            href={loginHref}
            aria-current={current === 'login' ? 'page' : undefined}
            className="hidden rounded-md px-3 py-2 text-[15px] font-medium text-[var(--color-ink)] hover:text-[var(--color-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)] aria-[current=page]:text-[var(--color-accent)] sm:inline-flex"
          >
            Login
          </a>
          <ButtonLink href={registerHref} size="sm" cta="create-store-header" className="hidden sm:inline-flex">
            Create Your Store
          </ButtonLink>
          <MobileNav items={primary} loginHref={loginHref} registerHref={registerHref} />
        </div>
      </div>
    </MarketingHeaderFrame>
  );
}

export function MarketingFooter({
  siteOrigin,
  loginHref,
  registerHref,
  contactEmail,
}: MarketingLinks & { contactEmail?: string | null }) {
  return (
    <footer className="border-t border-[var(--color-border)] bg-[#10231e] text-[#c9d6d1]">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_3fr]">
          <div>
            <MarketingLogo href={marketingHref(siteOrigin, '/')} onDark />
            <p className="mt-4 max-w-xs text-sm leading-relaxed">
              An ecommerce platform for Bangladesh businesses — online store, orders, payments
              and delivery in one place.
            </p>
            <div className="mt-6 flex flex-wrap gap-3 text-sm">
              <a href={registerHref} data-cta="create-store-footer" className="font-semibold text-white underline-offset-4 hover:underline">
                Create Your Store
              </a>
              <span aria-hidden="true">·</span>
              <a href={loginHref} className="underline-offset-4 hover:underline">
                Merchant login
              </a>
            </div>
            {contactEmail ? (
              <p className="mt-4 text-sm">
                <a href={`mailto:${contactEmail}`} className="underline-offset-4 hover:underline">
                  {contactEmail}
                </a>
              </p>
            ) : null}
          </div>
          <nav aria-label="Footer" className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-5">
            {FOOTER_NAV.map((group) => (
              <div key={group.heading}>
                <h2 className="text-sm font-semibold text-white">{group.heading}</h2>
                <ul className="mt-3 space-y-2 text-sm">
                  {group.items.map((item) => (
                    <li key={item.href}>
                      <Link
                        href={marketingHref(siteOrigin, item.href)}
                        className="underline-offset-4 hover:text-white hover:underline"
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>
        <div className="mt-12 flex flex-col gap-2 border-t border-white/10 pt-6 text-xs sm:flex-row sm:justify-between">
          <p>© {new Date().getFullYear()} Ecomesta. All rights reserved.</p>
          <p>Built for selling in Bangladesh · Prices in BDT</p>
        </div>
      </div>
    </footer>
  );
}

export function MarketingShell({
  children,
  contactEmail,
  current,
  ...links
}: MarketingLinks & {
  children: ReactNode;
  contactEmail?: string | null;
  current?: MarketingCurrentPage;
}) {
  return (
    <div className="flex min-h-screen flex-col overflow-x-clip bg-[#fbfaf7] text-[var(--color-ink)]">
      <MarketingHeader {...links} current={current} />
      <main id="main-content" className="flex-1">
        {children}
      </main>
      <MarketingFooter {...links} contactEmail={contactEmail} />
    </div>
  );
}
