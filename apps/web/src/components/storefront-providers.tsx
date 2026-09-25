'use client';

import { Suspense, type ReactNode } from 'react';
import type { PublicStore } from '@ecomesta/types';
import { CartProvider } from '@/lib/cart';
import { StorefrontFooter, StorefrontHeader } from '@/components/storefront-chrome';

export function StorefrontProviders({
  store,
  children,
}: {
  store: PublicStore;
  children: ReactNode;
}) {
  return (
    <CartProvider storeId={store.id} storeSlug={store.slug} currency={store.currency}>
      <div className="flex min-h-screen flex-col">
        <Suspense fallback={<div className="h-16 border-b border-[var(--color-border)]" />}>
          <StorefrontHeader store={store} />
        </Suspense>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
        <StorefrontFooter store={store} />
      </div>
    </CartProvider>
  );
}
