'use client';

import { Suspense, type ReactNode } from 'react';
import type { PublicStore, PublicStoreTheme } from '@ecomesta/types';
import { AnnouncementBar } from '@/components/storefront/announcement-bar';
import { StorefrontFooter } from '@/components/storefront/storefront-footer';
import { StorefrontHeader } from '@/components/storefront/storefront-header';
import { ShopEaseFooter, ShopEaseHeader, ShopEaseTopBar } from '@/components/storefront/shopease/shopease-chrome';
import { StoreTagInstaller, StoreTracking } from '@/components/storefront/store-tracking';
import { ThemePreviewBridge } from '@/components/storefront/theme-preview-bridge';
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
  // Premium theme with its own chrome; the API only reports it when the store may use it.
  const shopEase = theme?.theme?.slug === 'shopease';
  return (
    <ThemeProvider theme={theme}>
      <CartProvider storeId={store.id} storeSlug={store.slug} currency={store.currency}>
        {/* Before the page, so its events find the tags installed (never in the editor preview). */}
        {theme?.preview ? null : <StoreTagInstaller tracking={store.tracking} />}
        <div
          lang={storeLang(store)}
          className="flex min-h-screen flex-col bg-[var(--color-bg)]"
        >
          {shopEase ? (
            <Suspense fallback={<div className="h-16 border-b border-[var(--color-border)]" />}>
              <ShopEaseTopBar store={store} />
              <ShopEaseHeader store={store} />
            </Suspense>
          ) : (
            <>
              <AnnouncementBar
                config={theme?.configuration ?? {}}
                storeSlug={store.slug}
              />
              <Suspense
                fallback={<div className="h-16 border-b border-[var(--color-border)]" />}
              >
                <StorefrontHeader store={store} />
              </Suspense>
            </>
          )}
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
          {theme?.preview ? (
            <ThemePreviewBridge />
          ) : (
            <Suspense fallback={null}>
              <StoreTracking tracking={store.tracking} />
            </Suspense>
          )}
          <Suspense fallback={null}>
            {shopEase ? <ShopEaseFooter store={store} /> : <StorefrontFooter store={store} />}
          </Suspense>
        </div>
      </CartProvider>
    </ThemeProvider>
  );
}
