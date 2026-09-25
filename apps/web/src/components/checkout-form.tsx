'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type {
  PublicCheckoutConfirmation,
  PublicCheckoutPaymentMethod,
  PublicCheckoutPaymentProvider,
} from '@ecomesta/types';
import { Button } from '@ecomesta/ui';
import { useCart } from '@/lib/cart';
import { formatMoney, multiplyMoney } from '@/lib/money';
import { publicPost, PublicApiError } from '@/lib/public-api';

type AddressForm = {
  name: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
};

const emptyAddress = (): AddressForm => ({
  name: '',
  phone: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  postalCode: '',
  country: 'US',
});

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1 text-sm">
      <span className="font-medium text-[var(--color-ink)]">{label}</span>
      {children}
    </label>
  );
}

const inputClass =
  'w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]';

export function CheckoutForm() {
  const router = useRouter();
  const formId = useId();
  const {
    lines,
    currency,
    subtotal,
    storeSlug,
    clear,
  } = useCart();

  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [shipping, setShipping] = useState<AddressForm>(emptyAddress);
  const [billingSame, setBillingSame] = useState(true);
  const [billing, setBilling] = useState<AddressForm>(emptyAddress);
  const [paymentProvider, setPaymentProvider] =
    useState<PublicCheckoutPaymentProvider>('COD');
  const [paymentMethod, setPaymentMethod] =
    useState<PublicCheckoutPaymentMethod>('CASH');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const idempotencyKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `checkout-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }
  }, []);

  const shippingPreview = useMemo(() => '0.00', []);
  const totalPreview = subtotal;

  if (lines.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-16 text-center">
        <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight">
          Checkout
        </h1>
        <p className="mt-3 text-[var(--color-muted)]">Your cart is empty.</p>
        <Link
          href={`/products?store=${encodeURIComponent(storeSlug)}`}
          className="mt-4 inline-block text-[var(--color-accent)] hover:underline"
        >
          Continue shopping
        </Link>
      </div>
    );
  }

  function updateShipping<K extends keyof AddressForm>(key: K, value: AddressForm[K]) {
    setShipping((prev) => ({ ...prev, [key]: value }));
  }

  function updateBilling<K extends keyof AddressForm>(key: K, value: AddressForm[K]) {
    setBilling((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setError(null);

    if (!contactName.trim() || !email.trim()) {
      setError('Name and email are required.');
      return;
    }
    if (!shipping.addressLine1.trim() || !shipping.city.trim() || !shipping.country.trim()) {
      setError('Complete the required shipping address fields.');
      return;
    }
    if (
      !billingSame &&
      (!billing.addressLine1.trim() || !billing.city.trim() || !billing.country.trim())
    ) {
      setError('Complete the required billing address fields.');
      return;
    }

    setSubmitting(true);
    try {
      const body = {
        items: lines.map((line) => ({
          productId: line.productId,
          variantId: line.variantId,
          quantity: line.quantity,
        })),
        customer: {
          name: contactName.trim(),
          email: email.trim(),
          phone: phone.trim() || undefined,
        },
        shippingAddress: {
          name: shipping.name.trim() || contactName.trim(),
          phone: shipping.phone.trim() || phone.trim() || undefined,
          email: email.trim(),
          addressLine1: shipping.addressLine1.trim(),
          addressLine2: shipping.addressLine2.trim() || undefined,
          city: shipping.city.trim(),
          state: shipping.state.trim() || undefined,
          postalCode: shipping.postalCode.trim() || undefined,
          country: shipping.country.trim(),
        },
        billingSameAsShipping: billingSame,
        billingAddress: billingSame
          ? undefined
          : {
              name: billing.name.trim() || contactName.trim(),
              phone: billing.phone.trim() || phone.trim() || undefined,
              email: email.trim(),
              addressLine1: billing.addressLine1.trim(),
              addressLine2: billing.addressLine2.trim() || undefined,
              city: billing.city.trim(),
              state: billing.state.trim() || undefined,
              postalCode: billing.postalCode.trim() || undefined,
              country: billing.country.trim(),
            },
        paymentProvider,
        paymentMethod,
        customerNote: note.trim() || undefined,
      };

      const result = await publicPost<{
        success: true;
        data: PublicCheckoutConfirmation;
      }>(`/public/stores/${encodeURIComponent(storeSlug)}/checkout`, body, {
        idempotencyKey: idempotencyKeyRef.current ?? undefined,
      });

      clear();
      idempotencyKeyRef.current = null;
      router.push(
        `/order-confirmation/${encodeURIComponent(result.data.publicReference)}?store=${encodeURIComponent(storeSlug)}`,
      );
    } catch (err) {
      const message =
        err instanceof PublicApiError
          ? err.message
          : 'Could not place your order. Please review your cart and try again.';
      setError(message);
      // Keep the same idempotency key so retries do not create duplicates.
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      id={formId}
      onSubmit={onSubmit}
      className="grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.9fr)]"
      noValidate
    >
      <div className="space-y-8">
        <section className="space-y-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <h2 className="text-lg font-semibold">Contact</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Full name">
              <input
                className={inputClass}
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                autoComplete="name"
                required
                aria-required
              />
            </Field>
            <Field label="Email">
              <input
                type="email"
                className={inputClass}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </Field>
            <Field label="Phone">
              <input
                className={inputClass}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoComplete="tel"
              />
            </Field>
          </div>
        </section>

        <section className="space-y-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <h2 className="text-lg font-semibold">Shipping address</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Recipient name">
              <input
                className={inputClass}
                value={shipping.name}
                onChange={(e) => updateShipping('name', e.target.value)}
                placeholder="Defaults to contact name"
              />
            </Field>
            <Field label="Phone">
              <input
                className={inputClass}
                value={shipping.phone}
                onChange={(e) => updateShipping('phone', e.target.value)}
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Address line 1">
                <input
                  className={inputClass}
                  value={shipping.addressLine1}
                  onChange={(e) => updateShipping('addressLine1', e.target.value)}
                  required
                  autoComplete="address-line1"
                />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Address line 2">
                <input
                  className={inputClass}
                  value={shipping.addressLine2}
                  onChange={(e) => updateShipping('addressLine2', e.target.value)}
                  autoComplete="address-line2"
                />
              </Field>
            </div>
            <Field label="City">
              <input
                className={inputClass}
                value={shipping.city}
                onChange={(e) => updateShipping('city', e.target.value)}
                required
                autoComplete="address-level2"
              />
            </Field>
            <Field label="State / province">
              <input
                className={inputClass}
                value={shipping.state}
                onChange={(e) => updateShipping('state', e.target.value)}
                autoComplete="address-level1"
              />
            </Field>
            <Field label="Postal code">
              <input
                className={inputClass}
                value={shipping.postalCode}
                onChange={(e) => updateShipping('postalCode', e.target.value)}
                autoComplete="postal-code"
              />
            </Field>
            <Field label="Country (ISO-2)">
              <input
                className={inputClass}
                value={shipping.country}
                onChange={(e) => updateShipping('country', e.target.value.toUpperCase())}
                maxLength={2}
                required
                autoComplete="country"
              />
            </Field>
          </div>
        </section>

        <section className="space-y-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Billing address</h2>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={billingSame}
                onChange={(e) => setBillingSame(e.target.checked)}
              />
              Same as shipping
            </label>
          </div>
          {!billingSame ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Name">
                <input
                  className={inputClass}
                  value={billing.name}
                  onChange={(e) => updateBilling('name', e.target.value)}
                />
              </Field>
              <Field label="Phone">
                <input
                  className={inputClass}
                  value={billing.phone}
                  onChange={(e) => updateBilling('phone', e.target.value)}
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Address line 1">
                  <input
                    className={inputClass}
                    value={billing.addressLine1}
                    onChange={(e) => updateBilling('addressLine1', e.target.value)}
                    required
                  />
                </Field>
              </div>
              <Field label="City">
                <input
                  className={inputClass}
                  value={billing.city}
                  onChange={(e) => updateBilling('city', e.target.value)}
                  required
                />
              </Field>
              <Field label="Country (ISO-2)">
                <input
                  className={inputClass}
                  value={billing.country}
                  onChange={(e) => updateBilling('country', e.target.value.toUpperCase())}
                  maxLength={2}
                  required
                />
              </Field>
              <Field label="State">
                <input
                  className={inputClass}
                  value={billing.state}
                  onChange={(e) => updateBilling('state', e.target.value)}
                />
              </Field>
              <Field label="Postal code">
                <input
                  className={inputClass}
                  value={billing.postalCode}
                  onChange={(e) => updateBilling('postalCode', e.target.value)}
                />
              </Field>
            </div>
          ) : (
            <p className="text-sm text-[var(--color-muted)]">
              Billing will match the shipping address.
            </p>
          )}
        </section>

        <section className="space-y-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <h2 className="text-lg font-semibold">Payment</h2>
          <p className="text-sm text-[var(--color-muted)]">
            Online card gateways are not available yet. Choose an offline method.
          </p>
          <fieldset className="space-y-2">
            <legend className="sr-only">Payment method</legend>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="radio"
                name="pay"
                checked={paymentProvider === 'COD' && paymentMethod === 'CASH'}
                onChange={() => {
                  setPaymentProvider('COD');
                  setPaymentMethod('CASH');
                }}
              />
              <span>
                <span className="font-medium">Cash on delivery</span>
                <span className="block text-[var(--color-muted)]">
                  Pay when your order arrives (COD / CASH).
                </span>
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="radio"
                name="pay"
                checked={
                  paymentProvider === 'OTHER' && paymentMethod === 'BANK_TRANSFER'
                }
                onChange={() => {
                  setPaymentProvider('OTHER');
                  setPaymentMethod('BANK_TRANSFER');
                }}
              />
              <span>
                <span className="font-medium">Bank transfer</span>
                <span className="block text-[var(--color-muted)]">
                  Manual offline transfer (OTHER / BANK_TRANSFER).
                </span>
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="radio"
                name="pay"
                checked={paymentProvider === 'OTHER' && paymentMethod === 'OTHER'}
                onChange={() => {
                  setPaymentProvider('OTHER');
                  setPaymentMethod('OTHER');
                }}
              />
              <span>
                <span className="font-medium">Other offline payment</span>
                <span className="block text-[var(--color-muted)]">
                  Arrange payment directly with the store.
                </span>
              </span>
            </label>
          </fieldset>
          <Field label="Order note (optional)">
            <textarea
              className={`${inputClass} min-h-20`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={2000}
            />
          </Field>
        </section>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <h2 className="text-lg font-semibold">Order summary</h2>
          <ul className="mt-4 space-y-3">
            {lines.map((line) => (
              <li key={`${line.productId}:${line.variantId ?? 'base'}`} className="text-sm">
                <div className="flex justify-between gap-3">
                  <span>
                    {line.productName}
                    {line.variantName ? ` · ${line.variantName}` : ''} × {line.quantity}
                  </span>
                  <span className="shrink-0 font-medium">
                    {formatMoney(multiplyMoney(line.unitPrice, line.quantity), currency)}
                  </span>
                </div>
                <p className="text-xs text-[var(--color-muted)]">
                  Display estimate — final price is calculated on the server.
                </p>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-2 border-t border-[var(--color-border)] pt-4 text-sm">
            <div className="flex justify-between">
              <dt>Subtotal (estimate)</dt>
              <dd>{formatMoney(subtotal, currency)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Shipping</dt>
              <dd>{formatMoney(shippingPreview, currency)}</dd>
            </div>
            <div className="flex justify-between text-base font-semibold">
              <dt>Total (estimate)</dt>
              <dd>{formatMoney(totalPreview, currency)}</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-[var(--color-muted)]">
            Server recalculates prices and stock when you place the order. Shipping is
            $0 in this phase.
          </p>

          {error ? (
            <p className="mt-4 text-sm text-[var(--color-danger)]" role="alert">
              {error}
            </p>
          ) : null}

          <Button
            type="submit"
            className="mt-4 w-full"
            disabled={submitting}
            aria-busy={submitting}
          >
            {submitting ? 'Placing order…' : 'Place order'}
          </Button>
        </div>
      </aside>
    </form>
  );
}
