'use client';

import { Suspense, type ReactNode } from 'react';
import type { PublicStore, PublicStoreTheme } from '@ecomesta/types';
import { AnnouncementBar } from '@/components/storefront/announcement-bar';
import { StorefrontFooter } from '@/components/storefront/storefront-footer';
import { StorefrontHeader } from '@/components/storefront/storefront-header';
import { ThemeProvider } from '@/components/storefront/theme-provider';
import { CartProvider } from '@/lib/cart';
import { storeLang } from '@/lib/store-seo';

export function StorefrontProviders({
  store,
  theme = null,
  children,
}: {
  store: PublicStore;
  theme?: PublicStoreTheme | null;
  children: ReactNode;
}) {
  return (
    <ThemeProvider theme={theme}>
      <CartProvider storeId={store.id} storeSlug={store.slug} currency={store.currency}>
        <div
          lang={storeLang(store)}
          className="flex min-h-screen flex-col bg-[var(--color-bg)]"
        >
          <AnnouncementBar
            config={theme?.configuration ?? {}}
            storeSlug={store.slug}
          />
          <Suspense
            fallback={<div className="h-16 border-b border-[var(--color-border)]" />}
          >
            <StorefrontHeader store={store} />
          </Suspense>
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
          <Suspense fallback={null}>
            <StorefrontFooter store={store} />
          </Suspense>
        </div>
      </CartProvider>
    </ThemeProvider>
  );
}
