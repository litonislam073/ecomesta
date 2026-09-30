'use client';

import { useStoreContext } from '@/lib/store-context';
import { storefrontUrl } from '@/lib/storefront-url';

export function ViewStoreLink() {
  const { selectedStore } = useStoreContext();

  if (!selectedStore) {
    return null;
  }

  return (
    <a
      href={storefrontUrl(selectedStore.slug)}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-sm font-medium text-[var(--color-ink)] transition-colors hover:bg-[var(--color-bg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
      aria-label={`View store ${selectedStore.name} (opens in a new tab)`}
    >
      View store
      <span aria-hidden="true">↗</span>
    </a>
  );
}
