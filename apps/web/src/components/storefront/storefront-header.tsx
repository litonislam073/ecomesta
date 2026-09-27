'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import type { PublicStore, ThemeMenuItem } from '@ecomesta/types';
import { Button } from '@ecomesta/ui';
import { CartDrawer } from '@/components/cart-drawer';
import { useStoreThemeConfig } from '@/components/storefront/theme-provider';
import { useCart } from '@/lib/cart';
import { withStoreParam } from '@/lib/theme';

const DEFAULT_MENU: ThemeMenuItem[] = [
  { label: 'Home', href: '/' },
  { label: 'Products', href: '/products' },
  { label: 'Track order', href: '/track-order' },
];

export function StorefrontHeader({ store }: { store: PublicStore }) {
  const { itemCount, setDrawerOpen } = useCart();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const storeSlug = searchParams.get('store') ?? store.slug;

  const config = useStoreThemeConfig();
  const branding = config.branding ?? {};
  const header = config.header ?? {};
  const brandName = branding.brandName?.trim() || store.name;
  const logoUrl = branding.logoUrl ?? store.logoUrl;
  const menu = header.menuItems?.length ? header.menuItems : DEFAULT_MENU;
  const showCart = header.showCart !== false;
  const layout = header.layout ?? 'classic';

  return (
    <>
      <header
        className={`border-b border-[var(--color-border)] bg-[var(--color-surface)]/90 backdrop-blur ${
          header.sticky ? 'sticky top-0 z-40' : ''
        }`}
      >
        <div
          className={`mx-auto flex max-w-6xl gap-4 px-4 py-4 ${
            layout === 'centered'
              ? 'flex-col items-center'
              : 'items-center justify-between'
          }`}
        >
          <Link
            href={withStoreParam('/', storeSlug)}
            className="flex min-w-0 items-center gap-3"
          >
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt=""
                className="h-10 w-10 object-cover"
                style={{ borderRadius: 'var(--theme-radius, 0.375rem)' }}
              />
            ) : (
              <span
                className="flex h-10 w-10 items-center justify-center bg-[var(--color-accent)] text-sm font-semibold text-white"
                style={{ borderRadius: 'var(--theme-radius, 0.375rem)' }}
                aria-hidden
              >
                {brandName.slice(0, 1).toUpperCase()}
              </span>
            )}
            <span className="truncate font-[family-name:var(--font-display)] text-xl tracking-tight text-[var(--color-ink)]">
              {brandName}
            </span>
          </Link>

          {layout === 'minimal' ? null : (
            <nav
              className="hidden items-center gap-4 text-sm sm:flex"
              aria-label="Primary"
            >
              {menu.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={`${item.label}-${item.href}`}
                    href={withStoreParam(item.href, storeSlug)}
                    className={
                      active
                        ? 'font-semibold text-[var(--color-accent)]'
                        : 'text-[var(--color-muted)] hover:text-[var(--color-ink)]'
                    }
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          )}

          <div className="flex items-center gap-2">
            {header.showSearch ? (
              <Link
                href={withStoreParam('/products', storeSlug)}
                className="hidden text-sm text-[var(--color-muted)] hover:text-[var(--color-ink)] sm:inline"
              >
                Search
              </Link>
            ) : null}
            {showCart ? (
              <>
                <Link href={withStoreParam('/cart', storeSlug)} className="sm:hidden">
                  <Button variant="secondary" aria-label={`Cart, ${itemCount} items`}>
                    Cart ({itemCount})
                  </Button>
                </Link>
                <Button
                  className="hidden sm:inline-flex"
                  variant="secondary"
                  onClick={() => setDrawerOpen(true)}
                  aria-label={`Open cart, ${itemCount} items`}
                >
                  Cart ({itemCount})
                </Button>
              </>
            ) : null}
          </div>
        </div>
      </header>
      <CartDrawer />
    </>
  );
}
