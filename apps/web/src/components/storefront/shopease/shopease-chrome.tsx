'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import type { PublicStore, ThemeMenuItem } from '@ecomesta/types';
import { withHomeMenuItem } from '@ecomesta/utils';
import { CartDrawer } from '@/components/cart-drawer';
import { useStoreThemeConfig } from '@/components/storefront/theme-provider';
import { useCart } from '@/lib/cart';
import { withStoreParam } from '@/lib/theme';
import { Icon } from './icons';

const DEFAULT_MENU: ThemeMenuItem[] = [
  { label: 'Shop', href: '/products' },
  { label: 'Track order', href: '/track-order' },
];

const DARK = 'var(--theme-secondary, #0f2b20)';

function useStoreSlug(store: PublicStore) {
  return useSearchParams().get('store') ?? store.slug;
}

function BrandMark({ store, size = 'md' }: { store: PublicStore; size?: 'md' | 'sm' }) {
  const config = useStoreThemeConfig();
  const brandName = config.branding?.brandName?.trim() || store.name;
  const tagline = config.branding?.tagline?.trim();
  const logoUrl = config.branding?.logoUrl ?? store.logoUrl;
  const box = size === 'md' ? 'h-11 w-11' : 'h-9 w-9';
  return (
    <span className="flex min-w-0 items-center gap-3">
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="" className={`${box} shrink-0 rounded-xl object-cover`} />
      ) : (
        <span className={`${box} flex shrink-0 items-center justify-center rounded-xl bg-[var(--color-accent)] text-white`} aria-hidden>
          <Icon name="bag" className="h-5 w-5" />
        </span>
      )}
      <span className="min-w-0">
        <span className="block truncate text-xl font-extrabold tracking-tight text-[var(--color-ink)]">{brandName}</span>
        {tagline ? <span className="block truncate text-xs text-[var(--color-muted)]">{tagline}</span> : null}
      </span>
    </span>
  );
}

/** Dark promo strip above the header (the announcement, plus a secure-checkout note). */
export function ShopEaseTopBar({ store }: { store: PublicStore }) {
  const config = useStoreThemeConfig();
  const announcement = config.announcement ?? {};
  const text = announcement.enabled !== false ? announcement.text?.trim() : '';
  const storeSlug = useStoreSlug(store);
  return (
    <div data-theme-section="announcement" className="text-white" style={{ backgroundColor: DARK }}>
      <div className="mx-auto flex max-w-6xl items-center justify-center gap-8 px-4 py-2.5 text-xs sm:justify-between">
        {text ? (
          announcement.href ? (
            <Link href={withStoreParam(announcement.href, storeSlug)} className="flex items-center gap-2 font-semibold hover:underline">
              <Icon name="truck" className="h-4 w-4 text-[var(--color-accent)]" />
              {text}
            </Link>
          ) : (
            <p className="flex items-center gap-2 font-semibold">
              <Icon name="truck" className="h-4 w-4 text-[var(--color-accent)]" />
              {text}
            </p>
          )
        ) : (
          <span />
        )}
        <p className="hidden items-center gap-2 font-semibold sm:flex">
          <Icon name="lock" className="h-4 w-4 text-[var(--color-accent)]" />
          Secure checkout
        </p>
      </div>
    </div>
  );
}

export function ShopEaseHeader({ store }: { store: PublicStore }) {
  const { itemCount, setDrawerOpen } = useCart();
  const pathname = usePathname();
  const storeSlug = useStoreSlug(store);
  const header = useStoreThemeConfig().header ?? {};
  const menu = withHomeMenuItem(header.menuItems?.length ? header.menuItems : DEFAULT_MENU);
  const showCart = header.showCart !== false;

  return (
    <>
      <header data-theme-section="header" className={`border-b border-[var(--color-border)] bg-white/95 backdrop-blur ${header.sticky !== false ? 'sticky top-0 z-40' : ''}`}>
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3.5">
          <Link href={withStoreParam('/', storeSlug)} className="min-w-0">
            <BrandMark store={store} />
          </Link>
          <nav className="hidden items-center gap-7 text-sm font-medium md:flex" aria-label="Primary">
            {menu.map((item) => (
              <Link
                key={`${item.label}-${item.href}`}
                href={withStoreParam(item.href, storeSlug)}
                className={pathname === item.href ? 'text-[var(--color-accent)]' : 'text-[var(--color-ink)] hover:text-[var(--color-accent)]'}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex shrink-0 items-center gap-2">
            {header.showSearch !== false ? (
              <Link
                href={withStoreParam('/products', storeSlug)}
                aria-label="Search products"
                className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--color-ink)] hover:bg-[var(--color-surface)]"
              >
                <Icon name="search" />
              </Link>
            ) : null}
            {showCart ? (
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                aria-label={`Open cart, ${itemCount} items`}
                className="relative flex h-10 w-10 items-center justify-center rounded-full text-[var(--color-ink)] hover:bg-[var(--color-surface)]"
              >
                <Icon name="cart" />
                {itemCount > 0 ? (
                  <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--color-accent)] px-1 text-[10px] font-bold text-white">
                    {itemCount}
                  </span>
                ) : null}
              </button>
            ) : null}
            <Link
              href={withStoreParam('/products', storeSlug)}
              className="hidden rounded-lg bg-[var(--color-accent)] px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-white hover:bg-[var(--color-accent-hover)] sm:inline-flex"
            >
              Shop now
            </Link>
          </div>
        </div>
        {/* Phones: the menu stays reachable without a drawer. */}
        <nav className="flex gap-5 overflow-x-auto border-t border-[var(--color-border)] px-4 py-2 text-sm font-medium md:hidden" aria-label="Primary (mobile)">
          {menu.map((item) => (
            <Link key={`m-${item.label}-${item.href}`} href={withStoreParam(item.href, storeSlug)} className="shrink-0 text-[var(--color-ink)]">
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <CartDrawer />
    </>
  );
}

const SOCIAL_LABELS: Record<string, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  twitter: 'Twitter',
  x: 'X',
  youtube: 'YouTube',
  tiktok: 'TikTok',
  linkedin: 'LinkedIn',
  other: 'Website',
};

export function ShopEaseFooter({ store }: { store: PublicStore }) {
  const storeSlug = useStoreSlug(store);
  const config = useStoreThemeConfig();
  const footer = config.footer ?? {};
  const brandName = config.branding?.brandName?.trim() || store.name;
  const copyright = footer.copyright?.trim() || `© ${new Date().getFullYear()} ${brandName}. All rights reserved.`;
  const contact = store.contact ?? { email: null, phone: null, address: null };
  const quickLinks = footer.menuItems?.length ? footer.menuItems : DEFAULT_MENU;

  return (
    <footer data-theme-section="footer" className="mt-auto">
      <div className="bg-[var(--color-surface)]">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
          <div className="space-y-4">
            <BrandMark store={store} size="sm" />
            {footer.tagline ? <p className="max-w-xs text-sm text-[var(--color-muted)]">{footer.tagline}</p> : null}
            {footer.socialLinks?.length ? (
              <ul className="flex flex-wrap gap-2" aria-label="Social profiles">
                {footer.socialLinks.map((link) => (
                  <li key={`${link.network}-${link.url}`}>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[var(--color-ink)] shadow-sm hover:text-[var(--color-accent)]"
                    >
                      {SOCIAL_LABELS[link.network] ?? link.network}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <nav aria-label="Quick links">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--color-ink)]">Quick links</h2>
            <ul className="mt-4 space-y-2.5 text-sm text-[var(--color-muted)]">
              {quickLinks.map((item) => (
                <li key={`${item.label}-${item.href}`}>
                  <Link href={withStoreParam(item.href, storeSlug)} className="hover:text-[var(--color-accent)]">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <nav aria-label="Customer care">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--color-ink)]">Customer care</h2>
            <ul className="mt-4 space-y-2.5 text-sm text-[var(--color-muted)]">
              <li>
                <Link href={withStoreParam('/track-order', storeSlug)} className="hover:text-[var(--color-accent)]">Track your order</Link>
              </li>
              <li>
                <Link href={withStoreParam('/cart', storeSlug)} className="hover:text-[var(--color-accent)]">Your cart</Link>
              </li>
              <li>
                <Link href={withStoreParam('/products', storeSlug)} className="hover:text-[var(--color-accent)]">All products</Link>
              </li>
            </ul>
          </nav>
          {contact.email || contact.phone || contact.address ? (
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--color-ink)]">Contact us</h2>
              <address className="mt-4 space-y-2.5 text-sm not-italic text-[var(--color-muted)]" aria-label="Store contact">
                {contact.email ? (
                  <a href={`mailto:${contact.email}`} className="flex items-center gap-2 hover:text-[var(--color-accent)]">
                    <Icon name="mail" className="h-4 w-4 shrink-0" />
                    <span className="break-all">{contact.email}</span>
                  </a>
                ) : null}
                {contact.phone ? (
                  <a href={`tel:${contact.phone.replace(/[^\d+]/g, '')}`} className="flex items-center gap-2 hover:text-[var(--color-accent)]">
                    <Icon name="phone" className="h-4 w-4 shrink-0" />
                    {contact.phone}
                  </a>
                ) : null}
                {contact.address ? (
                  <p className="flex items-start gap-2">
                    <Icon name="pin" className="mt-0.5 h-4 w-4 shrink-0" />
                    {contact.address}
                  </p>
                ) : null}
              </address>
            </div>
          ) : null}
        </div>
      </div>
      <div className="text-white/80" style={{ backgroundColor: DARK }}>
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-1 px-4 py-4 text-xs sm:flex-row">
          <p>{copyright}</p>
          <p>Powered by Ecomesta</p>
        </div>
      </div>
    </footer>
  );
}
