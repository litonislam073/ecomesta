import type { Metadata } from 'next';
import Link from 'next/link';
import { OrderConfirmationClient } from '@/components/order-confirmation-client';
import { requirePublicStore } from '@/lib/store-resolver';

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: { reference: string };
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<Metadata> {
  try {
    const { store } = await requirePublicStore(searchParams);
    return {
      title: `Order ${params.reference} · ${store.name}`,
      robots: { index: false, follow: false },
    };
  } catch {
    return { title: `Order ${params.reference}` };
  }
}

export default async function OrderConfirmationPage({
  params,
  searchParams,
}: {
  params: { reference: string };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const { store, storeSlug } = await requirePublicStore(searchParams);
  const reference = decodeURIComponent(params.reference);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Loaded in the browser with the checkout contact proof, which never goes in the URL. */}
      <OrderConfirmationClient storeSlug={storeSlug} storeName={store.name} reference={reference} />

      <div className="flex flex-wrap justify-center gap-4 text-sm">
        <Link
          href={`/track-order?store=${encodeURIComponent(storeSlug)}`}
          className="text-[var(--color-accent)] hover:underline"
        >
          Track another order
        </Link>
        <Link
          href={`/products?store=${encodeURIComponent(storeSlug)}`}
          className="text-[var(--color-accent)] hover:underline"
        >
          Continue shopping
        </Link>
      </div>
    </div>
  );
}
