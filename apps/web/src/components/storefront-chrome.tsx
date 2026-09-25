'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import type { PublicStore } from '@ecomesta/types';
import { Button } from '@ecomesta/ui';
import { useCart } from '@/lib/cart';
import { CartDrawer } from '@/components/cart-drawer';

function withStore(href: string, storeSlug: string) {
  const url = new URL(href, 'http://local');
  url.searchParams.set('store', storeSlug);
  return `${url.pathname}${url.search}`;
}

export function StorefrontHeader({ store }: { store: PublicStore }) {
  const { itemCount, setDrawerOpen } = useCart();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const storeSlug = searchParams.get('store') ?? store.slug;

  const nav = [
    { href: '/', label: 'Home' },
    { href: '/products', label: 'Products' },
  ];

  return (
    <>
      <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)]/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <Link
            href={withStore('/', storeSlug)}
            className="flex min-w-0 items-center gap-3"
          >
            {store.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={store.logoUrl}
                alt=""
                className="h-10 w-10 rounded-md object-cover"
              />
            ) : (
              <span
                className="flex h-10 w-10 items-center justify-center rounded-md bg-[var(--color-accent)] text-sm font-semibold text-white"
                aria-hidden
              >
                {store.name.slice(0, 1).toUpperCase()}
              </span>
            )}
            <span className="truncate font-[family-name:var(--font-display)] text-xl tracking-tight text-[var(--color-ink)]">
              {store.name}
            </span>
          </Link>

          <nav className="hidden items-center gap-4 text-sm sm:flex" aria-label="Primary">
            {nav.map((item) => {
              const href = withStore(item.href, storeSlug);
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={href}
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

          <div className="flex items-center gap-2">
            <Link href={withStore('/cart', storeSlug)} className="sm:hidden">
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
          </div>
        </div>
      </header>
      <CartDrawer />
    </>
  );
}

export function StorefrontFooter({ store }: { store: PublicStore }) {
  return (
    <footer className="mt-auto border-t border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-sm text-[var(--color-muted)] sm:flex-row sm:items-center sm:justify-between">
        <p>
          © {new Date().getFullYear()} {store.name}
        </p>
        <p>Powered by Ecomesta</p>
      </div>
    </footer>
  );
}
