'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import type { PublicStore, ThemeMenuItem } from '@ecomesta/types';
import { withHomeMenuItem } from '@ecomesta/utils';
import { CartDrawer } from '@/components/cart-drawer';
import { useStoreThemeConfig } from '@/components/storefront/theme-provider';
import { useCart } from '@/lib/cart';
import { withStoreParam } from '@/lib/theme';
import { KIcon } from './icons';
import { KK } from './kenakata-utils';


const DEFAULT_MENU: ThemeMenuItem[] = [
  { label: 'All products', href: '/products' },
  { label: 'Track order', href: '/track-order' },
];

export function useKenakataStoreSlug(store: PublicStore) {
  return useSearchParams().get('store') ?? store.slug;
}

/** Logo (or a bag mark in the brand colour) and the store name. */
export function KenakataBrand({ store, inverse = false }: { store: PublicStore; inverse?: boolean }) {
  const config = useStoreThemeConfig();
  const brandName = config.branding?.brandName?.trim() || store.name;
  const logoUrl = config.branding?.logoUrl ?? store.logoUrl;
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="" className="h-9 w-9 shrink-0 rounded-xl object-cover" />
      ) : (
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--color-accent)] text-white">
          <KIcon name="bag" className="h-5 w-5" />
        </span>
      )}
      <span
        className={`truncate font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight sm:text-3xl ${
          inverse ? 'text-white' : 'text-[var(--color-ink)]'
        }`}
      >
        {brandName}
      </span>
    </span>
  );
}

/** The announcement in a dark strip above the header. */
export function KenakataTopBar({ store }: { store: PublicStore }) {
  const announcement = useStoreThemeConfig().announcement ?? {};
  const storeSlug = useKenakataStoreSlug(store);
  const pathname = usePathname();
  const text = announcement.enabled !== false ? announcement.text?.trim() : '';
  // Checkout keeps its focused header without the promo strip.
  if (!text || pathname.startsWith('/checkout')) return null;
  return (
    <div data-theme-section="announcement" className="px-4 py-2.5 text-center text-sm text-white" style={{ backgroundColor: KK.ink }}>
      {announcement.href ? (
        <Link href={withStoreParam(announcement.href, storeSlug)} className="hover:underline">
          {text}
        </Link>
      ) : (
        text
      )}
    </div>
  );
}

function CartButton({ storeSlug }: { storeSlug: string }) {
  const { itemCount } = useCart();
  return (
    <Link
      href={withStoreParam('/cart', storeSlug)}
      aria-label={`Cart, ${itemCount} ${itemCount === 1 ? 'item' : 'items'}`}
      className="relative flex h-11 w-11 items-center justify-center rounded-full text-[var(--color-ink)] hover:bg-[var(--color-surface)]"
    >
      <KIcon name="cart" />
      <span
        className="absolute right-0 top-0 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-semibold text-white"
        style={{ backgroundColor: KK.sale }}
      >
        {itemCount}
      </span>
    </Link>
  );
}

function SearchForm({ storeSlug, className, inputLabel }: { storeSlug: string; className: string; inputLabel: string }) {
  return (
    <form action="/products" method="get" role="search" className={className}>
      <input type="hidden" name="store" value={storeSlug} />
      <KIcon name="search" className="h-5 w-5 shrink-0 text-[var(--color-muted)]" />
      <input
        type="search"
        name="q"
        aria-label="Search products"
        placeholder={inputLabel}
        className="min-w-0 flex-1 bg-transparent text-[var(--color-ink)] outline-none placeholder:text-[var(--color-muted)]"
      />
    </form>
  );
}

/** Logo, checkout steps and a secure-checkout note: the focused checkout header. */
function KenakataCheckoutHeader({ store, storeSlug }: { store: PublicStore; storeSlug: string }) {
  const steps: { label: string; state: 'done' | 'now' | 'todo' }[] = [
    { label: 'Cart', state: 'done' },
    { label: 'Details and payment', state: 'now' },
    { label: 'Confirmation', state: 'todo' },
  ];
  return (
    <header data-theme-section="header" className="border-b border-[var(--color-border)] bg-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-8">
        <Link href={withStoreParam('/', storeSlug)} className="min-w-0">
          <KenakataBrand store={store} />
        </Link>
        <ol className="hidden items-center gap-4 text-[15px] sm:flex" aria-label="Checkout steps">
          {steps.map((step, index) => (
            <li key={step.label} className="flex items-center gap-4">
              {index > 0 ? <span aria-hidden="true" className="h-px w-7 bg-[var(--color-border)]" /> : null}
              <span className={`flex items-center gap-2 ${step.state === 'now' ? 'font-semibold text-[var(--color-ink)]' : 'text-[var(--color-muted)]'}`}>
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${
                    step.state === 'done'
                      ? 'bg-[color-mix(in_srgb,var(--color-accent)_14%,white)] text-[var(--color-ink)]'
                      : step.state === 'now'
                        ? 'bg-[var(--color-accent)] text-white'
                        : 'border border-[var(--color-border)]'
                  }`}
                >
                  {step.state === 'done' ? <KIcon name="check" className="h-4 w-4" /> : index + 1}
                </span>
                {step.label}
                {step.state === 'now' ? <span className="sr-only">(current step)</span> : null}
              </span>
            </li>
          ))}
        </ol>
        <p className="flex items-center gap-2 text-sm text-[var(--color-muted)]">
          <KIcon name="lock" className="h-[18px] w-[18px]" />
          Secure checkout
        </p>
      </div>
    </header>
  );
}

export function KenakataHeader({ store }: { store: PublicStore }) {
  const pathname = usePathname();
  const storeSlug = useKenakataStoreSlug(store);
  const header = useStoreThemeConfig().header ?? {};
  const [menuOpen, setMenuOpen] = useState(false);
  if (pathname.startsWith('/checkout')) return <KenakataCheckoutHeader store={store} storeSlug={storeSlug} />;

  const menu = withHomeMenuItem(header.menuItems?.length ? header.menuItems : DEFAULT_MENU);
  const showSearch = header.showSearch !== false;
  const showCart = header.showCart !== false;

  return (
    <>
      <header
        data-theme-section="header"
        className={`border-b border-[var(--color-border)] bg-white ${header.sticky !== false ? 'sticky top-0 z-40' : ''}`}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-8">
          <div className="flex items-center gap-3 py-3 sm:gap-8">
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              aria-controls="kk-mobile-menu"
              className="-ml-2 flex h-11 w-11 items-center justify-center rounded-full text-[var(--color-ink)] hover:bg-[var(--color-surface)] lg:hidden"
            >
              <KIcon name={menuOpen ? 'close' : 'menu'} className="h-6 w-6" />
            </button>
            <Link href={withStoreParam('/', storeSlug)} className="min-w-0">
              <KenakataBrand store={store} />
            </Link>
            {showSearch ? (
              <SearchForm
                storeSlug={storeSlug}
                inputLabel="Search for products"
                className="hidden h-12 flex-1 items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-5 focus-within:border-[var(--color-accent)] focus-within:ring-2 focus-within:ring-[color-mix(in_srgb,var(--color-accent)_20%,transparent)] md:flex"
              />
            ) : (
              <span className="hidden flex-1 md:block" />
            )}
            <div className="ml-auto flex items-center gap-1 md:ml-0">
              <Link
                href={withStoreParam('/track-order', storeSlug)}
                className="hidden h-11 items-center gap-2 rounded-full px-3 font-medium text-[var(--color-ink)] hover:bg-[var(--color-surface)] sm:flex"
              >
                <KIcon name="truck" />
                Track order
              </Link>
              <Link
                href={withStoreParam('/track-order', storeSlug)}
                aria-label="Track order"
                className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--color-ink)] hover:bg-[var(--color-surface)] sm:hidden"
              >
                <KIcon name="truck" />
              </Link>
              {showCart ? <CartButton storeSlug={storeSlug} /> : null}
            </div>
          </div>
          {showSearch ? (
            <SearchForm
              storeSlug={storeSlug}
              inputLabel="Search products"
              className="mb-3 flex h-12 items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-5 md:hidden"
            />
          ) : null}
          <nav className="hidden flex-wrap gap-x-7 text-[15px] font-medium lg:flex" aria-label="Primary">
            {menu.map((item, index) => (
              <Link
                key={`${item.label}-${item.href}`}
                href={withStoreParam(item.href, storeSlug)}
                className={`py-3 hover:text-[var(--color-accent)] ${
                  pathname === item.href ? 'text-[var(--color-accent)]' : 'text-[var(--color-ink)]'
                } ${index === 0 ? 'font-semibold' : ''}`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <nav
          id="kk-mobile-menu"
          hidden={!menuOpen}
          className="border-t border-[var(--color-border)] bg-white lg:hidden"
          aria-label="Primary (mobile)"
        >
          <div className="mx-auto flex max-w-7xl flex-col px-4 py-2 sm:px-8">
            {menu.map((item) => (
              <Link
                key={`m-${item.label}-${item.href}`}
                href={withStoreParam(item.href, storeSlug)}
                onClick={() => setMenuOpen(false)}
                className="border-b border-[var(--color-border)] py-3 font-medium text-[var(--color-ink)] last:border-0"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </nav>
      </header>
      <CartDrawer />
    </>
  );
}

const SOCIAL: Record<string, { label: string; path: string; fill?: boolean }> = {
  facebook: {
    label: 'Facebook',
    fill: true,
    path: 'M13.5 21v-7.5H16l.5-3h-3V8.6c0-.9.3-1.5 1.6-1.5h1.5V4.4c-.3 0-1.2-.1-2.2-.1-2.3 0-3.9 1.4-3.9 4v2.2H8v3h2.5V21h3z',
  },
  instagram: { label: 'Instagram', path: 'M8.5 3.5h7a5 5 0 0 1 5 5v7a5 5 0 0 1-5 5h-7a5 5 0 0 1-5-5v-7a5 5 0 0 1 5-5zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z' },
  youtube: {
    label: 'YouTube',
    fill: true,
    path: 'M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2C2 8.8 2 12 2 12s0 3.2.4 4.8a2.5 2.5 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8c.4-1.6.4-4.8.4-4.8s0-3.2-.4-4.8zM10 15V9l5.2 3L10 15z',
  },
};

// Shown when the merchant keeps "payment icons" on in the theme editor, like the other themes.
const PAYMENT_CHIPS = ['bKash', 'Nagad', 'Cards', 'Cash on delivery'];

/** The full footer on the homepage; a compact one on the other pages, as in the design. */
export function KenakataFooter({ store }: { store: PublicStore }) {
  const pathname = usePathname();
  const storeSlug = useKenakataStoreSlug(store);
  const config = useStoreThemeConfig();
  const footer = config.footer ?? {};
  const brandName = config.branding?.brandName?.trim() || store.name;
  const copyright = footer.copyright?.trim() || `© ${new Date().getFullYear()} ${brandName}. All rights reserved.`;
  const contact = store.contact ?? { email: null, phone: null, address: null };
  const links = footer.menuItems?.length ? footer.menuItems : DEFAULT_MENU;
  const link = (item: ThemeMenuItem) => (
    <Link key={`${item.label}-${item.href}`} href={withStoreParam(item.href, storeSlug)} className="hover:text-white">
      {item.label}
    </Link>
  );

  if (pathname !== '/') {
    return (
      <footer data-theme-section="footer" className="mt-16 text-slate-300" style={{ backgroundColor: KK.ink }}>
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm sm:px-8">
          <p>{copyright}</p>
          <nav className="flex flex-wrap gap-x-6 gap-y-2" aria-label="Footer">
            {links.map(link)}
          </nav>
        </div>
      </footer>
    );
  }

  return (
    <footer data-theme-section="footer" className="mt-16 text-slate-300" style={{ backgroundColor: KK.ink }}>
      <div className="mx-auto max-w-7xl px-4 pb-8 pt-14 sm:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-4">
            <p className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight text-white">{brandName}</p>
            {footer.tagline ? <p className="max-w-xs">{footer.tagline}</p> : null}
            {contact.address || contact.phone || contact.email ? (
              <address className="text-sm not-italic">
                {contact.address ? <span className="block">{contact.address}</span> : null}
                {[contact.phone, contact.email].filter(Boolean).join(' · ')}
              </address>
            ) : null}
          </div>
          <nav className="flex flex-col gap-3" aria-label="Shop">
            <h2 className="mb-1 text-sm font-semibold uppercase tracking-widest text-white">Shop</h2>
            {links.map(link)}
          </nav>
          <nav className="flex flex-col gap-3" aria-label="Help">
            <h2 className="mb-1 text-sm font-semibold uppercase tracking-widest text-white">Help</h2>
            {link({ label: 'Track your order', href: '/track-order' })}
            {link({ label: 'Your cart', href: '/cart' })}
            {link({ label: 'All products', href: '/products' })}
          </nav>
          {footer.socialLinks?.length ? (
            <div className="flex flex-col gap-4">
              <h2 className="mb-1 text-sm font-semibold uppercase tracking-widest text-white">Follow us</h2>
              <ul className="flex flex-wrap gap-3">
                {footer.socialLinks.map((social) => {
                  const known = SOCIAL[social.network];
                  return (
                    <li key={`${social.network}-${social.url}`}>
                      <a
                        href={social.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        aria-label={known?.label ?? social.network}
                        className="flex h-11 min-w-11 items-center justify-center rounded-full border border-white/25 px-3 text-sm hover:bg-white hover:text-[var(--color-ink)]"
                      >
                        {known ? (
                          <svg
                            viewBox="0 0 24 24"
                            className="h-5 w-5"
                            fill={known.fill ? 'currentColor' : 'none'}
                            stroke={known.fill ? 'none' : 'currentColor'}
                            strokeWidth={2}
                            aria-hidden="true"
                          >
                            <path d={known.path} />
                          </svg>
                        ) : (
                          social.network
                        )}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </div>
        <div className="mt-12 flex flex-col gap-5 border-t border-white/15 pt-6 text-sm md:flex-row md:items-center md:justify-between">
          <p>{copyright}</p>
          {footer.showPaymentIcons !== false ? (
            <ul className="flex flex-wrap gap-2" aria-label="Accepted payment methods">
              {PAYMENT_CHIPS.map((chip) => (
                <li key={chip} className="rounded-lg border border-white/30 px-3 py-1.5 font-semibold text-white">
                  {chip}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </footer>
  );
}
