'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type {
  BdLocationItem,
  PublicCheckoutConfirmation,
  PublicCheckoutPaymentMethod,
  PublicCheckoutPaymentProvider,
  PublicCheckoutQuote,
  PublicPaymentInitiation,
  PublicPaymentProvidersResponse,
  PublicShippingMethod,
} from '@ecomesta/types';
import { Button } from '@ecomesta/ui';
import { lineKey, useCart } from '@/lib/cart';
import { formatMoney } from '@/lib/money';
import { publicGet, publicPost, PublicApiError } from '@/lib/public-api';

const QUOTE_DEBOUNCE_MS = 250;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function samePrice(a: string, b: string) {
  return Number(a).toFixed(2) === Number(b).toFixed(2);
}

type AddressForm = {
  name: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  divisionId: string;
  districtId: string;
  upazilaId: string;
};

const emptyAddress = (): AddressForm => ({
  name: '',
  phone: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  postalCode: '',
  country: 'BD',
  divisionId: '',
  districtId: '',
  upazilaId: '',
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

export function CheckoutForm({
  requirePhone = false,
  allowOrderNotes = true,
}: {
  requirePhone?: boolean;
  allowOrderNotes?: boolean;
} = {}) {
  const router = useRouter();
  const formId = useId();
  const {
    lines,
    currency,
    storeSlug,
    clear,
    couponCode,
    setCouponCode,
    syncPrices,
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
  const [shippingMethods, setShippingMethods] = useState<PublicShippingMethod[]>(
    [],
  );
  const [shippingMethodId, setShippingMethodId] = useState<string>('');
  const [shippingLoadError, setShippingLoadError] = useState<string | null>(null);
  const [quoteZoneName, setQuoteZoneName] = useState<string | null>(null);
  const [divisions, setDivisions] = useState<BdLocationItem[]>([]);
  const [districts, setDistricts] = useState<BdLocationItem[]>([]);
  const [upazilas, setUpazilas] = useState<BdLocationItem[]>([]);
  const [onlineProviders, setOnlineProviders] = useState<
    PublicPaymentProvidersResponse['online']
  >([]);
  const [note, setNote] = useState('');
  const [couponDraft, setCouponDraft] = useState(couponCode ?? '');
  const [couponMessage, setCouponMessage] = useState<string | null>(null);
  // SF-03: every amount shown in the summary comes from the server quote.
  const [quote, setQuote] = useState<PublicCheckoutQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoteNonce, setQuoteNonce] = useState(0);
  const [priceNotices, setPriceNotices] = useState<string[]>([]);
  const [couponBusy, setCouponBusy] = useState(false);
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

  useEffect(() => {
    let cancelled = false;
    async function loadProvidersAndDivisions() {
      if (!storeSlug) return;
      setShippingLoadError(null);
      try {
        const [providersResult, divisionsResult] = await Promise.all([
          publicGet<{
            success: true;
            data: PublicPaymentProvidersResponse;
          }>(`/public/stores/${encodeURIComponent(storeSlug)}/payment-providers`),
          publicGet<{
            success: true;
            data: BdLocationItem[];
          }>(`/public/stores/${encodeURIComponent(storeSlug)}/locations/divisions`),
        ]);
        if (cancelled) return;
        setOnlineProviders(providersResult.data.online ?? []);
        setDivisions(divisionsResult.data);
      } catch (err) {
        if (cancelled) return;
        setOnlineProviders([]);
        setDivisions([]);
        setShippingLoadError(
          err instanceof PublicApiError
            ? err.message
            : 'Could not load checkout options.',
        );
      }
    }
    void loadProvidersAndDivisions();
    return () => {
      cancelled = true;
    };
  }, [storeSlug]);

  useEffect(() => {
    if (!storeSlug || !shipping.divisionId) {
      setDistricts([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const result = await publicGet<{
          success: true;
          data: BdLocationItem[];
        }>(
          `/public/stores/${encodeURIComponent(storeSlug)}/locations/districts?divisionId=${shipping.divisionId}`,
        );
        if (!cancelled) setDistricts(result.data);
      } catch {
        if (!cancelled) setDistricts([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [storeSlug, shipping.divisionId]);

  useEffect(() => {
    if (!storeSlug || !shipping.districtId) {
      setUpazilas([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const result = await publicGet<{
          success: true;
          data: BdLocationItem[];
        }>(
          `/public/stores/${encodeURIComponent(storeSlug)}/locations/upazilas?districtId=${shipping.districtId}`,
        );
        if (!cancelled) setUpazilas(result.data);
      } catch {
        if (!cancelled) setUpazilas([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [storeSlug, shipping.districtId]);

  // Only identifiers and quantities go to the server; the cart's stored prices
  // never do. Price-only cart updates (syncPrices) do not change this key.
  const itemsKey = JSON.stringify(
    lines.map((line) => [line.productId, line.variantId, line.quantity]),
  );
  // Per-customer coupon limits need the email, but only once it is complete.
  const quoteEmail =
    couponCode && EMAIL_PATTERN.test(email.trim()) ? email.trim() : '';

  useEffect(() => {
    if (!storeSlug || itemsKey === '[]') return;
    let cancelled = false;
    setQuoteLoading(true);
    const timer = window.setTimeout(async () => {
      const items = (JSON.parse(itemsKey) as [string, string | null, number][]).map(
        ([productId, variantId, quantity]) => ({ productId, variantId, quantity }),
      );
      try {
        const result = await publicPost<{
          success: true;
          data: PublicCheckoutQuote;
        }>(`/public/stores/${encodeURIComponent(storeSlug)}/checkout/quote`, {
          items,
          divisionId: shipping.divisionId || undefined,
          districtId: shipping.districtId || undefined,
          upazilaId: shipping.upazilaId || undefined,
          shippingMethodId: shippingMethodId || undefined,
          couponCode: couponCode || undefined,
          email: quoteEmail || undefined,
        });
        if (cancelled) return;
        const data = result.data;
        setQuote(data);
        setQuoteError(null);
        setShippingLoadError(null);
        setShippingMethods(data.shippingMethods);
        setQuoteZoneName(data.zone?.name ?? null);
        setShippingMethodId(data.shippingMethodId ?? '');
        setPriceNotices((prev) => {
          const changed = data.lines.flatMap((quoted) => {
            const stored = lines.find((l) => lineKey(l) === lineKey(quoted));
            if (!stored || samePrice(stored.unitPrice, quoted.unitPrice)) return [];
            const label = quoted.variantName
              ? `${quoted.productName} · ${quoted.variantName}`
              : quoted.productName;
            return [
              `${label}: price changed from ${formatMoney(stored.unitPrice, data.currency)} to ${formatMoney(quoted.unitPrice, data.currency)}.`,
            ];
          });
          return changed.length > 0 ? changed : prev;
        });
        syncPrices(data.lines);
        if (couponCode && data.couponError) {
          setCouponCode(null);
          setCouponDraft('');
          setCouponMessage(`Coupon ${couponCode} was removed: ${data.couponError}`);
        }
      } catch (err) {
        if (cancelled) return;
        setQuote(null);
        setQuoteError(
          err instanceof PublicApiError
            ? err.message
            : 'Could not calculate your order total. Please try again.',
        );
      } finally {
        if (!cancelled) setQuoteLoading(false);
      }
    }, QUOTE_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // `lines` is read only to word the price-change notice; itemsKey tracks the cart.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    storeSlug,
    itemsKey,
    shipping.divisionId,
    shipping.districtId,
    shipping.upazilaId,
    shippingMethodId,
    couponCode,
    quoteEmail,
    quoteNonce,
  ]);

  const selectedShipping = useMemo(
    () => shippingMethods.find((m) => m.id === shippingMethodId) ?? null,
    [shippingMethods, shippingMethodId],
  );
  const codAllowedForMethod = selectedShipping?.codAllowed !== false;
  // The order may only be placed against a finished quote for the current selection.
  const quoteReady =
    quote !== null &&
    !quoteLoading &&
    !quoteError &&
    (quote.shippingMethodId ?? '') === shippingMethodId;

  useEffect(() => {
    if (!codAllowedForMethod && paymentProvider === 'COD') {
      setPaymentProvider('OTHER');
      setPaymentMethod('BANK_TRANSFER');
    }
  }, [codAllowedForMethod, paymentProvider]);

  async function applyCoupon() {
    setCouponMessage(null);
    const code = couponDraft.trim().toUpperCase();
    if (!code) {
      setCouponMessage('Enter a coupon code.');
      return;
    }
    setCouponBusy(true);
    try {
      const result = await publicPost<{
        success: true;
        data: {
          valid: true;
          code: string;
          discount: string;
          subtotal: string;
          finalSubtotal: string;
          currency: string;
        };
      }>(`/public/stores/${encodeURIComponent(storeSlug)}/coupons/validate`, {
        code,
        email: email.trim() || undefined,
        items: lines.map((line) => ({
          productId: line.productId,
          variantId: line.variantId,
          quantity: line.quantity,
        })),
      });
      // The discount shown comes from the checkout quote this triggers.
      setCouponCode(result.data.code);
      setCouponDraft(result.data.code);
      setCouponMessage(`Coupon ${result.data.code} applied.`);
    } catch (err) {
      setCouponCode(null);
      setCouponMessage(
        err instanceof PublicApiError
          ? err.message
          : 'Could not apply this coupon.',
      );
    } finally {
      setCouponBusy(false);
    }
  }

  function removeCoupon() {
    setCouponCode(null);
    setCouponDraft('');
    setCouponMessage(null);
  }

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
    if (requirePhone && !phone.trim() && !shipping.phone.trim()) {
      setError('A phone number is required to place this order.');
      return;
    }
    if (!shipping.addressLine1.trim() || !shipping.country.trim()) {
      setError('Complete the required shipping address fields.');
      return;
    }
    if (!shipping.divisionId || !shipping.districtId || !shipping.upazilaId) {
      setError('Select division, district, and upazila for delivery.');
      return;
    }
    if (!shippingMethodId) {
      setError('Please select a shipping method.');
      return;
    }
    if (!quote || !quoteReady) {
      setError('Your order total is still being calculated. Please wait a moment.');
      return;
    }
    if (paymentProvider === 'COD' && selectedShipping?.codAllowed === false) {
      setError('Cash on delivery is not available for this shipping method.');
      return;
    }
    if (
      !billingSame &&
      (!billing.addressLine1.trim() || !billing.country.trim())
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
          city:
            shipping.city.trim() ||
            districts.find((d) => d.id === shipping.districtId)?.name ||
            'N/A',
          state:
            shipping.state.trim() ||
            divisions.find((d) => d.id === shipping.divisionId)?.name ||
            undefined,
          postalCode: shipping.postalCode.trim() || undefined,
          country: shipping.country.trim() || 'BD',
          divisionId: shipping.divisionId,
          districtId: shipping.districtId,
          upazilaId: shipping.upazilaId,
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
              city: billing.city.trim() || 'N/A',
              state: billing.state.trim() || undefined,
              postalCode: billing.postalCode.trim() || undefined,
              country: billing.country.trim() || 'BD',
              divisionId: billing.divisionId || undefined,
              districtId: billing.districtId || undefined,
              upazilaId: billing.upazilaId || undefined,
            },
        shippingMethodId,
        paymentProvider,
        paymentMethod,
        customerNote: allowOrderNotes ? note.trim() || undefined : undefined,
        couponCode: couponCode || undefined,
        // Not a price: the server refuses the order if its total differs.
        expectedTotal: quote.total,
      };

      const result = await publicPost<{
        success: true;
        data: PublicCheckoutConfirmation;
      }>(`/public/stores/${encodeURIComponent(storeSlug)}/checkout`, body, {
        idempotencyKey: idempotencyKeyRef.current ?? undefined,
      });

      if (
        paymentProvider === 'TEST' ||
        paymentProvider === 'STRIPE' ||
        paymentProvider === 'SSL_COMMERZ'
      ) {
        const initiated = await publicPost<{
          success: true;
          data: PublicPaymentInitiation;
        }>(`/public/stores/${encodeURIComponent(storeSlug)}/payments/create`, {
          publicReference: result.data.publicReference,
          provider: paymentProvider,
          email: email.trim(),
        });
        clear();
        idempotencyKeyRef.current = null;
        if (initiated.data.redirectUrl) {
          window.location.href = initiated.data.redirectUrl;
          return;
        }
        router.push(
          `/payment/success?store=${encodeURIComponent(storeSlug)}&order=${encodeURIComponent(result.data.publicReference)}&ref=${encodeURIComponent(initiated.data.internalReference)}&email=${encodeURIComponent(email.trim())}`,
        );
        return;
      }

      clear();
      idempotencyKeyRef.current = null;
      router.push(
        `/order-confirmation/${encodeURIComponent(result.data.publicReference)}?store=${encodeURIComponent(storeSlug)}&email=${encodeURIComponent(email.trim())}`,
      );
    } catch (err) {
      const message =
        err instanceof PublicApiError
          ? err.message
          : 'Could not place your order. Please review your cart and try again.';
      setError(message);
      if (err instanceof PublicApiError && err.code === 'CHECKOUT_TOTAL_CHANGED') {
        // No order was created; show the current total before the customer retries.
        setQuoteNonce((value) => value + 1);
      }
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
            <Field label={requirePhone ? 'Phone' : 'Phone (optional)'}>
              <input
                type="tel"
                className={inputClass}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoComplete="tel"
                required={requirePhone}
                aria-required={requirePhone || undefined}
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
            <Field label="Division">
              <select
                className={inputClass}
                value={shipping.divisionId}
                onChange={(e) =>
                  setShipping((prev) => ({
                    ...prev,
                    divisionId: e.target.value,
                    districtId: '',
                    upazilaId: '',
                  }))
                }
                required
              >
                <option value="">Select division…</option>
                {divisions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="District">
              <select
                className={inputClass}
                value={shipping.districtId}
                onChange={(e) =>
                  setShipping((prev) => ({
                    ...prev,
                    districtId: e.target.value,
                    upazilaId: '',
                  }))
                }
                disabled={!shipping.divisionId}
                required
              >
                <option value="">Select district…</option>
                {districts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Upazila / Thana">
              <select
                className={inputClass}
                value={shipping.upazilaId}
                onChange={(e) => updateShipping('upazilaId', e.target.value)}
                disabled={!shipping.districtId}
                required
              >
                <option value="">Select upazila…</option>
                {upazilas.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Area / landmark (optional)">
              <input
                className={inputClass}
                value={shipping.addressLine2}
                onChange={(e) => updateShipping('addressLine2', e.target.value)}
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Address line">
                <input
                  className={inputClass}
                  value={shipping.addressLine1}
                  onChange={(e) => updateShipping('addressLine1', e.target.value)}
                  required
                  autoComplete="address-line1"
                />
              </Field>
            </div>
            <Field label="Postal code">
              <input
                className={inputClass}
                value={shipping.postalCode}
                onChange={(e) => updateShipping('postalCode', e.target.value)}
                autoComplete="postal-code"
              />
            </Field>
            <Field label="Country">
              <input
                className={inputClass}
                value={shipping.country}
                onChange={(e) =>
                  updateShipping('country', e.target.value.toUpperCase())
                }
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
          <h2 className="text-lg font-semibold">Shipping method</h2>
          {quoteZoneName ? (
            <p className="text-sm text-[var(--color-muted)]">
              Delivery zone: {quoteZoneName}
            </p>
          ) : (
            <p className="text-sm text-[var(--color-muted)]">
              Select division, district, and upazila to see zone rates.
            </p>
          )}
          {shippingLoadError ? (
            <p className="text-sm text-red-700" role="alert">
              {shippingLoadError}
            </p>
          ) : null}
          {shippingMethods.length === 0 && !shippingLoadError ? (
            <p className="text-sm text-[var(--color-muted)]">
              No shipping methods are available for this location yet.
            </p>
          ) : (
            <fieldset className="space-y-2">
              <legend className="sr-only">Shipping method</legend>
              {shippingMethods.map((method) => {
                const amount = method.amount ?? method.price;
                const free =
                  method.freeShippingApplied ||
                  method.type === 'FREE' ||
                  amount === '0.00';
                return (
                  <label key={method.id} className="flex items-start gap-2 text-sm">
                    <input
                      type="radio"
                      name="shipping-method"
                      checked={shippingMethodId === method.id}
                      onChange={() => setShippingMethodId(method.id)}
                    />
                    <span>
                      <span className="font-medium">{method.name}</span>
                      <span className="block text-[var(--color-muted)]">
                        {free
                          ? method.freeShippingApplied
                            ? 'Free shipping applied'
                            : 'Free'
                          : formatMoney(amount, currency)}
                        {method.estimatedDelivery
                          ? ` · ${method.estimatedDelivery}`
                          : ''}
                        {method.description ? ` — ${method.description}` : ''}
                        {method.codAllowed === false ? ' · COD not available' : ''}
                      </span>
                    </span>
                  </label>
                );
              })}
            </fieldset>
          )}
        </section>

        <section className="space-y-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <h2 className="text-lg font-semibold">Coupon</h2>
          <div className="flex flex-wrap gap-2">
            <input
              className={`${inputClass} max-w-xs`}
              value={couponDraft}
              onChange={(e) => setCouponDraft(e.target.value.toUpperCase())}
              placeholder="SUMMER10"
              aria-label="Coupon code"
              disabled={!!couponCode}
            />
            {couponCode ? (
              <Button type="button" variant="secondary" onClick={removeCoupon}>
                Remove
              </Button>
            ) : (
              <Button
                type="button"
                variant="secondary"
                disabled={couponBusy}
                onClick={() => void applyCoupon()}
              >
                {couponBusy ? 'Checking…' : 'Apply'}
              </Button>
            )}
          </div>
          {couponMessage ? (
            <p
              className={`text-sm ${couponCode ? 'text-[var(--color-muted)]' : 'text-red-700'}`}
              role="status"
            >
              {couponMessage}
            </p>
          ) : null}
        </section>

        <section className="space-y-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <h2 className="text-lg font-semibold">Payment</h2>
          <p className="text-sm text-[var(--color-muted)]">
            Choose offline payment, or an enabled online provider when configured.
          </p>
          <fieldset className="space-y-2">
            <legend className="sr-only">Payment method</legend>
            <label
              className={`flex items-start gap-2 text-sm ${!codAllowedForMethod ? 'opacity-50' : ''}`}
            >
              <input
                type="radio"
                name="pay"
                checked={paymentProvider === 'COD' && paymentMethod === 'CASH'}
                disabled={!codAllowedForMethod}
                onChange={() => {
                  setPaymentProvider('COD');
                  setPaymentMethod('CASH');
                }}
              />
              <span>
                <span className="font-medium">Cash on delivery</span>
                <span className="block text-[var(--color-muted)]">
                  {codAllowedForMethod
                    ? 'Pay when your order arrives (COD / CASH).'
                    : 'Not available for the selected shipping method.'}
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
            {onlineProviders.some((p) => p.provider === 'TEST') ? (
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="radio"
                  name="pay"
                  checked={paymentProvider === 'TEST'}
                  onChange={() => {
                    setPaymentProvider('TEST');
                    setPaymentMethod('CARD');
                  }}
                />
                <span>
                  <span className="font-medium">Online test payment</span>
                  <span className="block text-[var(--color-muted)]">
                    Simulated gateway (TEST). Paid only after verified webhook.
                  </span>
                </span>
              </label>
            ) : null}
            {onlineProviders.some((p) => p.provider === 'STRIPE') ? (
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="radio"
                  name="pay"
                  checked={paymentProvider === 'STRIPE'}
                  onChange={() => {
                    setPaymentProvider('STRIPE');
                    setPaymentMethod('CARD');
                  }}
                />
                <span>
                  <span className="font-medium">Pay with card (Stripe)</span>
                  <span className="block text-[var(--color-muted)]">
                    Secure Stripe Checkout. Paid only after verified webhook.
                  </span>
                </span>
              </label>
            ) : null}
            {onlineProviders.some((p) => p.provider === 'SSL_COMMERZ') ? (
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="radio"
                  name="pay"
                  checked={paymentProvider === 'SSL_COMMERZ'}
                  onChange={() => {
                    setPaymentProvider('SSL_COMMERZ');
                    setPaymentMethod('CARD');
                  }}
                />
                <span>
                  <span className="font-medium">Online payment (SSLCommerz)</span>
                  <span className="block text-[var(--color-muted)]">
                    Bangladesh hosted checkout. Paid only after verified IPN +
                    Order Validation API.
                  </span>
                </span>
              </label>
            ) : null}
          </fieldset>
          {allowOrderNotes ? (
            <Field label="Order note (optional)">
              <textarea
                className={`${inputClass} min-h-20`}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={2000}
              />
            </Field>
          ) : null}
        </section>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <h2 className="text-lg font-semibold">Order summary</h2>
          {priceNotices.length > 0 ? (
            <div
              className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
              role="status"
            >
              <p className="font-medium">Prices in your cart have been updated.</p>
              <ul className="mt-1 list-disc pl-5">
                {priceNotices.map((notice) => (
                  <li key={notice}>{notice}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {quoteError ? (
            <div className="mt-3 text-sm text-[var(--color-danger)]" role="alert">
              <p>{quoteError}</p>
              <Link
                href={`/cart?store=${encodeURIComponent(storeSlug)}`}
                className="mt-1 inline-block text-[var(--color-accent)] hover:underline"
              >
                Review your cart
              </Link>
            </div>
          ) : null}
          {quote ? (
            <>
              <ul className="mt-4 space-y-3" aria-busy={quoteLoading}>
                {quote.lines.map((line) => (
                  <li key={lineKey(line)} className="text-sm">
                    <div className="flex justify-between gap-3">
                      <span>
                        {line.productName}
                        {line.variantName ? ` · ${line.variantName}` : ''} × {line.quantity}
                      </span>
                      <span className="shrink-0 font-medium">
                        {formatMoney(line.lineTotal, quote.currency)}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--color-muted)]">
                      {formatMoney(line.unitPrice, quote.currency)} each
                    </p>
                  </li>
                ))}
              </ul>
              <dl className="mt-4 space-y-2 border-t border-[var(--color-border)] pt-4 text-sm">
                <div className="flex justify-between">
                  <dt>Subtotal</dt>
                  <dd>{formatMoney(quote.subtotal, quote.currency)}</dd>
                </div>
                {quote.couponCode ? (
                  <div className="flex justify-between text-[var(--color-muted)]">
                    <dt>Discount ({quote.couponCode})</dt>
                    <dd>−{formatMoney(quote.discountTotal, quote.currency)}</dd>
                  </div>
                ) : null}
                <div className="flex justify-between">
                  <dt>Shipping</dt>
                  <dd>{formatMoney(quote.shippingTotal, quote.currency)}</dd>
                </div>
                <div className="flex justify-between text-base font-semibold">
                  <dt>Total</dt>
                  <dd>{formatMoney(quote.total, quote.currency)}</dd>
                </div>
              </dl>
            </>
          ) : !quoteError ? (
            <p className="mt-4 text-sm text-[var(--color-muted)]" role="status">
              Calculating current prices…
            </p>
          ) : null}
          <p className="mt-3 text-xs text-[var(--color-muted)]">
            {quoteLoading && quote
              ? 'Updating totals…'
              : 'Prices, shipping and discounts shown are the current store prices.'}
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
