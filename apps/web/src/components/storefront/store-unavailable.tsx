import type { Metadata } from 'next';
import { PublicApiError } from '@/lib/public-api';

export const STORE_UNAVAILABLE_CODE = 'STORE_UNAVAILABLE';

export const STORE_UNAVAILABLE_METADATA: Metadata = {
  title: 'Store temporarily unavailable',
  robots: { index: false, follow: false },
};

export function isStoreUnavailableError(err: unknown): boolean {
  return err instanceof PublicApiError && err.code === STORE_UNAVAILABLE_CODE;
}

/** Shown to shoppers while a store is suspended; deliberately says nothing about why. */
export function StoreUnavailable() {
  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-4 py-16 text-center">
      <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight">
        Store temporarily unavailable
      </h1>
      <p className="mt-3 text-[var(--color-muted)]">This store is currently unavailable.</p>
      <p className="mt-6 text-sm text-[var(--color-muted)]">Please check back later.</p>
    </div>
  );
}
