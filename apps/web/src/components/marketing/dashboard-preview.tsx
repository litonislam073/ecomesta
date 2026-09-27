import Image from 'next/image';
import { Floating } from '../animations/decorative';

const ORDERS = [
  { number: 'EM-100003', item: 'Cotton T-Shirt · Size M', payment: 'COD', paymentTone: 'amber', status: 'Pending' },
  { number: 'EM-100002', item: 'Wireless Headphones', payment: 'Paid', paymentTone: 'green', status: 'Processing' },
  { number: 'EM-100001', item: 'Ceramic Coffee Mug', payment: 'Paid', paymentTone: 'green', status: 'Shipped' },
] as const;

const TONES = {
  amber: 'bg-[#fdf3e1] text-[#8a5a14]',
  green: 'bg-[#e3f3ec] text-[#11694f]',
} as const;

const NAV = ['Dashboard', 'Products', 'Inventory', 'Orders', 'Customers', 'Payments', 'Shipping', 'Themes'];

/**
 * Illustrative merchant dashboard built from the sample catalog. It shows the
 * shape of the product, never performance claims.
 */
export function DashboardPreview() {
  return (
    <figure className="relative mx-auto w-full max-w-[640px]">
      <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white shadow-[0_24px_60px_-20px_rgba(16,35,30,0.35)]">
        <div className="flex items-center gap-2 border-b border-[var(--color-border)] bg-[#f6f8f7] px-4 py-2.5">
          <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-[#e5e7e6]" />
          <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-[#e5e7e6]" />
          <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-[#e5e7e6]" />
          <span className="ml-3 truncate rounded-md bg-white px-3 py-0.5 text-[11px] text-[var(--color-muted)]">
            Merchant dashboard
          </span>
        </div>
        <div className="grid grid-cols-[112px_1fr] sm:grid-cols-[132px_1fr]">
          <div className="border-r border-[var(--color-border)] bg-[#fafbfa] px-2 py-3">
            <p className="px-2 font-display text-sm font-semibold">Your Store</p>
            <ul className="mt-3 space-y-0.5 text-[11px] text-[var(--color-muted)]">
              {NAV.map((item) => (
                <li
                  key={item}
                  className={`rounded-md px-2 py-1.5 ${item === 'Orders' ? 'bg-[#e3f0ec] font-semibold text-[var(--color-accent)]' : ''}`}
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="min-w-0 space-y-3 p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Recent orders</p>
              <span className="rounded-md bg-[var(--color-accent)] px-2 py-1 text-[10px] font-semibold text-white">
                View all
              </span>
            </div>
            <ul className="divide-y divide-[var(--color-border)] rounded-lg border border-[var(--color-border)] text-[11px]">
              {ORDERS.map((order) => (
                <li key={order.number} className="flex items-center gap-2 px-2.5 py-2">
                  <span className="font-mono font-semibold">{order.number}</span>
                  <span className="hidden min-w-0 flex-1 truncate text-[var(--color-muted)] sm:block">{order.item}</span>
                  <span className={`ml-auto rounded px-1.5 py-0.5 font-semibold sm:ml-0 ${TONES[order.paymentTone]}`}>
                    {order.payment}
                  </span>
                  <span className="rounded bg-[#eef1f0] px-1.5 py-0.5 text-[var(--color-ink)]">{order.status}</span>
                </li>
              ))}
            </ul>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex gap-2.5 rounded-lg border border-[var(--color-border)] p-2.5">
                <Image
                  src="/demo-catalog/cotton-t-shirt.jpg"
                  alt=""
                  width={56}
                  height={42}
                  className="h-11 w-14 shrink-0 rounded-md object-cover"
                  priority
                />
                <div className="min-w-0 text-[11px]">
                  <p className="truncate font-semibold">Cotton T-Shirt</p>
                  <p className="text-[var(--color-muted)]">3 variants · ৳590</p>
                  <p className="mt-0.5 font-medium text-[var(--color-accent)]">In stock</p>
                </div>
              </div>
              <div className="rounded-lg border border-[var(--color-border)] p-2.5 text-[11px]">
                <p className="font-semibold">Delivery · Inside Dhaka</p>
                <p className="text-[var(--color-muted)]">Flat rate ৳60 · 1–2 days</p>
                <p className="mt-0.5 font-medium text-[var(--color-accent)]">COD allowed</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Floating className="absolute -bottom-6 -left-3 hidden w-40 overflow-hidden rounded-xl border border-[var(--color-border)] bg-white shadow-xl sm:block md:-left-8">
        <Image
          src="/demo-catalog/wireless-headphones.jpg"
          alt=""
          width={160}
          height={120}
          className="h-24 w-full object-cover"
          priority
        />
        <div className="p-2.5 text-[11px]">
          <p className="font-semibold">Wireless Headphones</p>
          <p className="text-[var(--color-muted)]">৳2,490</p>
          <span className="mt-1.5 block rounded-md bg-[var(--color-accent)] py-1 text-center font-semibold text-white">
            Add to cart
          </span>
        </div>
      </Floating>

      <Floating
        delay={1.2}
        className="absolute -right-2 -top-4 hidden rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-[11px] shadow-lg sm:block md:-right-6"
      >
        <p className="font-semibold">Payment verified</p>
        <p className="text-[var(--color-muted)]">SSLCommerz · order marked paid</p>
      </Floating>

      <figcaption className="sr-only">
        Illustration of the Ecomesta merchant dashboard using sample products: recent orders with
        payment and fulfillment status, a product with variants and stock, a delivery method with
        Cash on Delivery allowed, and a storefront product card.
      </figcaption>
    </figure>
  );
}
