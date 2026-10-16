import Link from 'next/link';
import type { ReactNode } from 'react';
import { CONTACT_ICON_PATHS, SOCIAL_LINKS, SUPPORT_PHONE, SUPPORT_WHATSAPP } from './contact';
import { MarketingHeaderFrame } from './header-frame';
import { MobileNav } from './mobile-nav';
import { SHELL_COPY, footerNav, legalNav, localizedHref, primaryNav, type MarketingLocale } from './i18n';
import { LanguageSwitch } from './language-switch';
import { marketingHref } from './nav';
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
  locale = 'en',
}: MarketingLinks & { current?: MarketingCurrentPage; locale?: MarketingLocale }) {
  const copy = SHELL_COPY[locale];
  const primary = primaryNav(locale).map((item) => ({
    ...item,
    href: marketingHref(siteOrigin, item.href),
  }));

  return (
    <MarketingHeaderFrame>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:shadow"
      >
        {copy.skip}
      </a>
      <div className="relative mx-auto flex h-16 max-w-[1200px] items-center justify-between gap-4 px-4 sm:px-6">
        <MarketingLogo href={marketingHref(siteOrigin, localizedHref('/', locale))} />
        <nav aria-label={copy.primaryLabel} className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {primary.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="whitespace-nowrap rounded-md px-2 py-2 text-[15px] font-medium text-[var(--color-muted)] transition-colors xl:px-3 hover:text-[var(--color-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex items-center gap-2">
          <LanguageSwitch siteOrigin={siteOrigin} />
          <a
            href={loginHref}
            aria-current={current === 'login' ? 'page' : undefined}
            className="hidden rounded-md px-3 py-2 text-[15px] font-medium text-[var(--color-ink)] hover:text-[var(--color-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)] aria-[current=page]:text-[var(--color-accent)] sm:inline-flex"
          >
            {copy.login}
          </a>
          <ButtonLink href={registerHref} size="sm" cta="create-store-header" className="hidden whitespace-nowrap sm:inline-flex">
            {copy.createStore}
          </ButtonLink>
          <MobileNav items={primary} loginHref={loginHref} registerHref={registerHref} copy={copy} />
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
  locale = 'en',
}: MarketingLinks & { contactEmail?: string | null; locale?: MarketingLocale }) {
  const copy = SHELL_COPY[locale];
  return (
    <footer className="border-t border-[var(--color-border)] bg-[var(--brand-navy)] text-[var(--brand-on-navy)]">
      <div className="mx-auto max-w-[1200px] px-4 py-14 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_3fr]">
          <div>
            <MarketingLogo href={marketingHref(siteOrigin, localizedHref('/', locale))} onDark />
            <p className="mt-4 max-w-xs text-sm leading-relaxed">{copy.tagline}</p>
            <div className="mt-6 flex flex-wrap gap-3 text-sm">
              <a href={registerHref} data-cta="create-store-footer" className="font-semibold text-white underline-offset-4 hover:underline">
                {copy.createStore}
              </a>
              <span aria-hidden="true">·</span>
              <a href={loginHref} className="underline-offset-4 hover:underline">
                {copy.merchantLogin}
              </a>
            </div>
            <ul className="mt-5 space-y-2 text-sm">
              <li>
                <a href={SUPPORT_PHONE.href} className="inline-flex items-center gap-2 py-1 underline-offset-4 hover:text-white hover:underline">
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d={CONTACT_ICON_PATHS.phone} />
                  </svg>
                  <span>
                    <span className="sr-only">{copy.phone}: </span>
                    {SUPPORT_PHONE.display}
                  </span>
                </a>
              </li>
              <li>
                <a
                  href={SUPPORT_WHATSAPP.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 py-1 underline-offset-4 hover:text-white hover:underline"
                >
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="currentColor">
                    <path d={CONTACT_ICON_PATHS.whatsapp} />
                  </svg>
                  <span>WhatsApp {SUPPORT_WHATSAPP.display}</span>
                </a>
              </li>
              {contactEmail ? (
                <li>
                  <a href={`mailto:${contactEmail}`} className="inline-block py-1 underline-offset-4 hover:text-white hover:underline">
                    {contactEmail}
                  </a>
                </li>
              ) : null}
            </ul>
            <ul aria-label={copy.social} className="mt-4 flex gap-2">
              {SOCIAL_LINKS.map((social) => (
                <li key={social.label}>
                  <a
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={copy.socialLink.replace('{network}', social.label)}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
                  >
                    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                      <path d={social.label === 'Facebook' ? CONTACT_ICON_PATHS.facebook : CONTACT_ICON_PATHS.youtube} />
                    </svg>
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <nav aria-label={copy.footerLabel} className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-5">
            {footerNav(locale).map((group) => (
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
        <div className="mt-12 flex flex-col gap-2 border-t border-white/10 pt-6 text-xs sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} Ecomesta. {copy.rights}
          </p>
          <nav aria-label={copy.legalLabel}>
            <ul className="flex flex-wrap gap-x-4 gap-y-2">
              {legalNav(locale).map((item) => (
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
          </nav>
        </div>
      </div>
    </footer>
  );
}

export function MarketingShell({
  children,
  contactEmail,
  current,
  locale = 'en',
  ...links
}: MarketingLinks & {
  children: ReactNode;
  contactEmail?: string | null;
  current?: MarketingCurrentPage;
  /** Bangla pages get Bangla navigation and the Bangla font. */
  locale?: MarketingLocale;
}) {
  return (
    <div
      lang={locale === 'bn' ? 'bn' : undefined}
      className={`ecomesta-brand flex min-h-screen flex-col overflow-x-clip bg-[var(--brand-paper)] text-[var(--color-ink)] ${locale === 'bn' ? 'ecomesta-bn' : ''}`}
    >
      <MarketingHeader {...links} current={current} locale={locale} />
      <main id="main-content" className="flex-1">
        {children}
      </main>
      <MarketingFooter {...links} contactEmail={contactEmail} locale={locale} />
    </div>
  );
}
