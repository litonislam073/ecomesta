import type { Metadata } from 'next';
import { CheckoutForm } from '@/components/checkout-form';
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
  const { store } = await requirePublicStore(searchParams);

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
