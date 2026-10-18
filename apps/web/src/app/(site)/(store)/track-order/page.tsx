import type { Metadata } from 'next';
import { Suspense } from 'react';
import { TrackOrderForm } from '@/components/track-order-form';
import { requirePublicStore } from '@/lib/store-resolver';

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<Metadata> {
  try {
    const { store } = await requirePublicStore(searchParams);
    return {
      title: `Track order · ${store.name}`,
      robots: { index: false, follow: false },
    };
  } catch {
    return { title: 'Track order' };
  }
}

export default async function TrackOrderPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const { storeSlug } = await requirePublicStore(searchParams);

  return (
    <Suspense fallback={<p className="text-sm text-[var(--color-muted)]">Loading…</p>}>
      <TrackOrderForm storeSlug={storeSlug} />
    </Suspense>
  );
}
