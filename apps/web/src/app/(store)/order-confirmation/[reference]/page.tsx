import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { PublicOrderConfirmationDetail } from '@ecomesta/types';
import { formatMoney } from '@/lib/money';
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
      title: `Order confirmed · ${store.name}`,
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

  let order: PublicOrderConfirmationDetail;
  try {
    const result = await publicGet<{
      success: true;
      data: PublicOrderConfirmationDetail;
    }>(
      `/public/stores/${encodeURIComponent(storeSlug)}/orders/${encodeURIComponent(reference)}`,
    );
    order = result.data;
  } catch (err) {
    if (err instanceof PublicApiError && err.status === 404) {
      notFound();
    }
    throw err;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-10 text-center">
        <p className="text-sm uppercase tracking-[0.2em] text-[var(--color-muted)]">
          Thank you
        </p>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-4xl tracking-tight">
          Order confirmed
        </h1>
        <p className="mt-3 text-[var(--color-muted)]">
          {store.name} received your order. Save your order number for reference.
        </p>
        <p className="mt-6 text-2xl font-semibold">{order.orderNumber}</p>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Status: {order.status} · Payment: {order.paymentStatus}
        </p>
      </div>

      <section className="space-y-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <h2 className="text-lg font-semibold">Summary</h2>
        <ul className="space-y-2 text-sm">
          {order.items.map((item, index) => (
            <li key={`${item.productName}-${index}`} className="flex justify-between gap-3">
              <span>
                {item.productName}
                {item.variantName ? ` · ${item.variantName}` : ''} × {item.quantity}
              </span>
              <span>{formatMoney(item.totalPrice, order.currency)}</span>
            </li>
          ))}
        </ul>
        <dl className="space-y-1 border-t border-[var(--color-border)] pt-3 text-sm">
          <div className="flex justify-between">
            <dt>Subtotal</dt>
            <dd>{formatMoney(order.subtotal, order.currency)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Shipping</dt>
            <dd>{formatMoney(order.shippingTotal, order.currency)}</dd>
          </div>
          <div className="flex justify-between font-semibold">
            <dt>Total</dt>
            <dd>{formatMoney(order.total, order.currency)}</dd>
          </div>
        </dl>
        <p className="text-sm text-[var(--color-muted)]">
          Payment: {order.paymentProvider ?? '—'} / {order.paymentMethod ?? '—'}
        </p>
      </section>

      {order.shippingAddress ? (
        <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 text-sm">
          <h2 className="text-lg font-semibold">Shipping</h2>
          <p className="mt-2">{order.shippingAddress.name}</p>
          <p>{order.shippingAddress.addressLine1}</p>
          {order.shippingAddress.addressLine2 ? (
            <p>{order.shippingAddress.addressLine2}</p>
          ) : null}
          <p>
            {[order.shippingAddress.city, order.shippingAddress.state, order.shippingAddress.postalCode]
              .filter(Boolean)
              .join(', ')}
          </p>
          <p>{order.shippingAddress.country}</p>
        </section>
      ) : null}

      <p className="text-center text-sm text-[var(--color-muted)]">
        Next steps: the store will process your order. Online payment gateways arrive in a
        later phase.
      </p>

      <div className="text-center">
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
