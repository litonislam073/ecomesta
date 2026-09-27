import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { PublicOrderConfirmationDetail } from '@ecomesta/types';
import { OrderTrackingView } from '@/components/order-tracking-view';
import { publicGet, PublicApiError } from '@/lib/public-api';
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
  const emailParam = searchParams.email;
  const email =
    typeof emailParam === 'string' && emailParam.trim()
      ? emailParam.trim()
      : null;

  if (!email) {
    notFound();
  }

  let order: PublicOrderConfirmationDetail;
  try {
    const qs = `?email=${encodeURIComponent(email)}`;
    const result = await publicGet<{
      success: true;
      data: PublicOrderConfirmationDetail;
    }>(
      `/public/stores/${encodeURIComponent(storeSlug)}/orders/${encodeURIComponent(reference)}${qs}`,
    );
    order = result.data;
  } catch (err) {
    if (err instanceof PublicApiError && err.status === 404) {
      notFound();
    }
    throw err;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-8 text-center">
        <p className="text-sm uppercase tracking-[0.2em] text-[var(--color-muted)]">
          Thank you
        </p>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-4xl tracking-tight">
          Order confirmed
        </h1>
        <p className="mt-3 text-[var(--color-muted)]">
          {store.name} received your order. Save your reference for tracking.
        </p>
      </div>

      <OrderTrackingView storeSlug={storeSlug} initial={order} email={email} />

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
