'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { PublicStore } from '@ecomesta/types';
import { useStoreThemeConfig } from '@/components/storefront/theme-provider';
import { withStoreParam } from '@/lib/theme';

const PAYMENT_LABELS = ['Cash on delivery', 'Bank transfer', 'Card'];

export function StorefrontFooter({ store }: { store: PublicStore }) {
  const searchParams = useSearchParams();
  const storeSlug = searchParams.get('store') ?? store.slug;

  const config = useStoreThemeConfig();
  const footer = config.footer ?? {};
  const brandName = config.branding?.brandName?.trim() || store.name;
  const copyright =
    footer.copyright?.trim() || `© ${new Date().getFullYear()} ${brandName}`;
  const contact = store.contact ?? { email: null, phone: null, address: null };

  return (
    <footer className="mt-auto border-t border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-[var(--color-muted)]">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[var(--color-ink)]">{copyright}</p>
            {footer.tagline ? <p className="mt-1">{footer.tagline}</p> : null}
          </div>
          {footer.menuItems?.length ? (
            <nav className="flex flex-wrap gap-4" aria-label="Footer">
              {footer.menuItems.map((item) => (
                <Link
                  key={`${item.label}-${item.href}`}
                  href={withStoreParam(item.href, storeSlug)}
                  className="hover:text-[var(--color-ink)]"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          ) : null}
        </div>

        {contact.email || contact.phone || contact.address ? (
          <address
            className="flex flex-col gap-1 not-italic sm:flex-row sm:flex-wrap sm:gap-x-6"
            aria-label="Store contact"
          >
            {contact.email ? (
              <a href={`mailto:${contact.email}`} className="hover:text-[var(--color-ink)]">
                {contact.email}
              </a>
            ) : null}
            {contact.phone ? (
              <a
                href={`tel:${contact.phone.replace(/[^\d+]/g, '')}`}
                className="hover:text-[var(--color-ink)]"
              >
                {contact.phone}
              </a>
            ) : null}
            {contact.address ? <span>{contact.address}</span> : null}
          </address>
        ) : null}

        {footer.socialLinks?.length ? (
          <ul className="flex flex-wrap gap-3" aria-label="Social profiles">
            {footer.socialLinks.map((link) => (
              <li key={`${link.network}-${link.url}`}>
                <a
                  href={link.url}
                  className="capitalize hover:text-[var(--color-ink)]"
                  rel="noreferrer noopener"
                  target="_blank"
                >
                  {link.network}
                </a>
              </li>
            ))}
          </ul>
        ) : null}

        {footer.showPaymentIcons ? (
          <ul className="flex flex-wrap gap-2 text-xs" aria-label="Payment methods">
            {PAYMENT_LABELS.map((label) => (
              <li
                key={label}
                className="border border-[var(--color-border)] px-2 py-1"
                style={{ borderRadius: 'var(--theme-radius, 0.25rem)' }}
              >
                {label}
              </li>
            ))}
          </ul>
        ) : null}

        <p className="text-xs">Powered by Ecomesta</p>
      </div>
    </footer>
  );
}
