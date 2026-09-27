import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { StorefrontProviders } from '@/components/storefront-providers';
import {
  STORE_UNAVAILABLE_METADATA,
  StoreUnavailable,
  isStoreUnavailableError,
} from '@/components/storefront/store-unavailable';
import { PublicApiError } from '@/lib/public-api';
import { resolveStoreSlug, fetchPublicStore } from '@/lib/store-resolver';
import { storeRobots } from '@/lib/store-seo';
import { fetchPublicTheme } from '@/lib/theme';

export async function generateMetadata(): Promise<Metadata> {
  try {
    const storeSlug = await resolveStoreSlug();
    if (!storeSlug) return {};
    const store = await fetchPublicStore(storeSlug);
    const robots = storeRobots(store);
    return robots ? { robots } : {};
  } catch (err) {
    return isStoreUnavailableError(err) ? STORE_UNAVAILABLE_METADATA : {};
  }
}

/**
 * Storefront chrome for catalog/checkout routes. The SaaS marketing homepage
 * lives at `app/page.tsx` and does not use this layout.
 */
export default async function StoreLayout({ children }: { children: ReactNode }) {
  try {
    const storeSlug = await resolveStoreSlug();
    if (!storeSlug) {
      throw new PublicApiError(
        404,
        'STORE_REQUIRED',
        'This storefront URL needs a store. On a custom domain or platform subdomain the store is selected automatically.',
      );
    }
    const [store, theme] = await Promise.all([
      fetchPublicStore(storeSlug),
      fetchPublicTheme(storeSlug),
    ]);
    return (
      <StorefrontProviders store={store} theme={theme}>
        {children}
      </StorefrontProviders>
    );
  } catch (err) {
    if (isStoreUnavailableError(err)) {
      return <StoreUnavailable />;
    }
    const message =
      err instanceof PublicApiError
        ? err.message
        : 'Unable to load this storefront.';
    return (
      <div className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-4 py-16 text-center">
        <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight">
          Store not found
        </h1>
        <p className="mt-3 text-[var(--color-muted)]">{message}</p>
        <p className="mt-6 text-sm text-[var(--color-muted)]">
          Check the link, or open the{' '}
          <a href="/" className="underline">
            Ecomesta homepage
          </a>
          .
        </p>
      </div>
    );
  }
}
