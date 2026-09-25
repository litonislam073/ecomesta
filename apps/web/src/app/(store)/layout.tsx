import type { ReactNode } from 'react';
import { StorefrontProviders } from '@/components/storefront-providers';
import { PublicApiError } from '@/lib/public-api';
import { resolveStoreSlug, fetchPublicStore } from '@/lib/store-resolver';

export default async function StoreLayout({ children }: { children: ReactNode }) {
  try {
    const storeSlug = await resolveStoreSlug();
    if (!storeSlug) {
      throw new PublicApiError(
        404,
        'STORE_REQUIRED',
        'Add ?store=your-store-slug to the URL (local multi-tenant resolution).',
      );
    }
    const store = await fetchPublicStore(storeSlug);
    return <StorefrontProviders store={store}>{children}</StorefrontProviders>;
  } catch (err) {
    const message =
      err instanceof PublicApiError
        ? err.message
        : 'Unable to load this storefront.';
    return (
      <div className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-4 py-16 text-center">
        <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight">
          Store unavailable
        </h1>
        <p className="mt-3 text-[var(--color-muted)]">{message}</p>
        <p className="mt-6 text-sm text-[var(--color-muted)]">
          For local development, open the site with{' '}
          <code className="rounded bg-white px-1">?store=your-store-slug</code>. Only ACTIVE
          stores are public.
        </p>
      </div>
    );
  }
}
