import type { Metadata } from 'next';
import Link from 'next/link';
import { CheckoutForm } from '@/components/checkout-form';
import { fetchStoreTheme } from '@/lib/theme-server';
import { requirePublicStore } from '@/lib/store-resolver';
import { NOINDEX } from '@/lib/store-seo';

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<Metadata> {
  try {
    const { store } = await requirePublicStore(searchParams);
    return {
      title: `Checkout · ${store.name}`,
      description: `Complete your order at ${store.name}`,
      robots: NOINDEX,
    };
  } catch {
    return { title: 'Checkout', robots: NOINDEX };
  }
}

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const { store, storeSlug } = await requirePublicStore(searchParams);
  const theme = await fetchStoreTheme(store.slug).catch(() => null);

  if (theme?.theme?.slug === 'kenakata') {
    return (
      <div className="kk-checkout">
        <Link href={`/cart?store=${encodeURIComponent(storeSlug)}`} className="inline-flex h-11 items-center font-semibold text-[var(--color-ink)] hover:underline">
          ← Back to cart
        </Link>
        <h1 className="pb-8 pt-2 font-[family-name:var(--font-display)] text-4xl font-bold leading-tight tracking-tight text-[var(--color-ink)]">
          Checkout
        </h1>
        <CheckoutForm allowOrderNotes={store.checkout?.allowOrderNotes ?? true} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-tight">
          Checkout
        </h1>
        <p className="mt-2 text-[var(--color-muted)]">
          Guest checkout — final prices and stock are confirmed by the server.
        </p>
      </div>
      <CheckoutForm
        allowOrderNotes={store.checkout?.allowOrderNotes ?? true}
      />
    </div>
  );
}
