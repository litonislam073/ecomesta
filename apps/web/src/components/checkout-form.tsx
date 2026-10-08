'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { trackBeginCheckout } from '@/lib/tracking';
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
import { contactProof, rememberOrderContact } from '@/lib/order-contact';
import { publicGet, publicPost, PublicApiError } from '@/lib/public-api';

const QUOTE_DEBOUNCE_MS = 250;
/**
 * A quote that has not answered by now is abandoned and shown as an error with
 * a retry, so the summary can never stay on "Calculating…" (e.g. a request to
 * an API that is restarting and never responds).
 */
const QUOTE_TIMEOUT_MS = 15_000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** 6–15 digits once spaces, dashes and brackets are removed (e.g. 01711-000000, +8801711000000). */
function isValidPhone(value: string) {
  const digits = value.replace(/[\s\-().]/g, '');
  return /^\+?\d{6,15}$/.test(digits);
}

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
  'w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2.5 text-sm placeholder:text-[var(--color-muted)] disabled:cursor-not-allowed disabled:bg-[var(--color-bg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-[var(--color-accent)]';

type IconName = 'cash' | 'bank' | 'store' | 'card' | 'wallet' | 'truck';

const ICON_PATHS: Record<IconName, React.ReactNode> = {
  cash: (
    <>
      <rect x="2.5" y="6" width="19" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M6 9.5v.01M18 14.5v.01" strokeLinecap="round" />
    </>
  ),
  bank: (
    <path
      d="M3 9.5 12 4l9 5.5M5 10v7M9.5 10v7M14.5 10v7M19 10v7M3 20h18"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  store: (
    <path
      d="M4 9h16l-1-4H5L4 9Zm0 0v10h16V9M9 19v-5h6v5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  card: (
    <>
      <rect x="2.5" y="5" width="19" height="14" rx="2" />
      <path d="M2.5 10h19M6.5 15h4" strokeLinecap="round" />
    </>
  ),
  wallet: (
    <>
      <rect x="6" y="2.5" width="12" height="19" rx="2.5" />
      <path d="M10.5 18.5h3" strokeLinecap="round" />
    </>
  ),
  truck: (
    <path
      d="M2.5 6h11v10h-11zM13.5 9.5h4l3 3.5V16h-7M6.5 18.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm11 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"
      strokeLinejoin="round"
    />
  ),
};

function OptionIcon({ name }: { name: IconName }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      className="h-5 w-5"
      aria-hidden="true"
    >
      {ICON_PATHS[name]}
    </svg>
  );
}

/** A selectable tile used for shipping and payment choices; the radio stays accessible. */
/** The store's own payment instructions (bank details etc.), shown as plain text. */
function PaymentDetails({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div role="note" className="-mt-1 rounded-xl border border-[var(--color-border)] bg-[#f7faf8] px-4 py-3 text-sm">
      <p className="font-semibold text-[var(--color-ink)]">{title}</p>
      <p className="mt-1 whitespace-pre-line text-[var(--color-ink)]">{children}</p>
    </div>
  );
}

function OptionTile({
  name,
  checked,
  disabled = false,
  onSelect,
  icon,
  title,
  description,
  aside,
  badges,
}: {
  name: string;
  checked: boolean;
  disabled?: boolean;
  onSelect: () => void;
  icon: IconName;
  title: string;
  description?: React.ReactNode;
  aside?: React.ReactNode;
  badges?: string[];
}) {
  return (
    <label
      className={`relative flex items-start gap-3 rounded-xl border p-4 transition-colors ${
        disabled
          ? 'cursor-not-allowed border-[var(--color-border)] opacity-55'
          : checked
            ? 'cursor-pointer border-[var(--color-accent)] bg-[color-mix(in_srgb,var(--color-accent)_7%,transparent)] ring-1 ring-[var(--color-accent)]'
            : 'cursor-pointer border-[var(--color-border)] hover:border-[color-mix(in_srgb,var(--color-accent)_45%,var(--color-border))]'
      }`}
    >
      <input
        type="radio"
        name={name}
        className="sr-only"
        checked={checked}
        disabled={disabled}
        onChange={onSelect}
      />
      <span
        aria-hidden="true"
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
          checked ? 'border-[var(--color-accent)]' : 'border-[var(--color-border)]'
        }`}
      >
        {checked ? <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-accent)]" /> : null}
      </span>
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
          checked
            ? 'bg-[var(--color-accent)] text-white'
            : 'bg-[var(--color-bg)] text-[var(--color-ink)]'
        }`}
      >
        <OptionIcon name={icon} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-3">
          <span className="font-medium text-[var(--color-ink)]">{title}</span>
          {aside ? <span className="shrink-0 text-sm font-semibold">{aside}</span> : null}
        </span>
        {description ? (
          <span className="mt-0.5 block text-sm text-[var(--color-muted)]">{description}</span>
        ) : null}
        {badges?.length ? (
          <span className="mt-2 flex flex-wrap gap-1.5">
            {badges.map((badge) => (
              <span
                key={badge}
                className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-0.5 text-xs font-medium text-[var(--color-muted)]"
              >
                {badge}
              </span>
            ))}
          </span>
        ) : null}
      </span>
    </label>
  );
}

function StepHeading({ step, title, hint }: { step: number; title: string; hint?: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)] text-sm font-semibold text-white">
        {step}
      </span>
      <div>
        <h2 className="text-lg font-semibold leading-7">{title}</h2>
        {hint ? <p className="text-sm text-[var(--color-muted)]">{hint}</p> : null}
      </div>
    </div>
  );
}

const sectionClass =
  'space-y-5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 sm:p-6';

export function CheckoutForm({
  allowOrderNotes = true,
}: {
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

  // Marketing tags: the shopper started checkout (once per visit to the page).
  const checkoutTracked = useRef(false);
  useEffect(() => {
    if (checkoutTracked.current || lines.length === 0) return;
    checkoutTracked.current = true;
    const items = lines.map((line) => ({
      id: line.sku || line.productId,
      name: line.productName,
      variant: line.variantName,
      price: Number(line.unitPrice),
      quantity: line.quantity,
    }));
    trackBeginCheckout(items, items.reduce((sum, item) => sum + item.price * item.quantity, 0), currency);
  }, [lines, currency]);

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
  // The store's own options it switched on (Cash on delivery, bank transfer, other); null until loaded.
  const [offlineOptions, setOfflineOptions] = useState<
    PublicPaymentProvidersResponse['offline'] | null
  >(null);
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
        const [providersResult, divisionsResult, districtsResult] = await Promise.all([
          publicGet<{
            success: true;
            data: PublicPaymentProvidersResponse;
          }>(`/public/stores/${encodeURIComponent(storeSlug)}/payment-providers`),
          publicGet<{
            success: true;
            data: BdLocationItem[];
          }>(`/public/stores/${encodeURIComponent(storeSlug)}/locations/divisions`),
          // Every district at once: the customer picks a district, never a division.
          publicGet<{
            success: true;
            data: BdLocationItem[];
          }>(`/public/stores/${encodeURIComponent(storeSlug)}/locations/districts`),
        ]);
        if (cancelled) return;
        setOnlineProviders(providersResult.data.online ?? []);
        setOfflineOptions(providersResult.data.offline ?? []);
        setDivisions(divisionsResult.data);
        setDistricts(districtsResult.data);
      } catch (err) {
        if (cancelled) return;
        setOnlineProviders([]);
        setOfflineOptions(null);
        setDivisions([]);
        setDistricts([]);
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

  // Everything a quote depends on. The quote answers for exactly these inputs.
  const quoteInputs = (methodId: string) =>
    JSON.stringify([
      storeSlug,
      itemsKey,
      shipping.divisionId,
      shipping.districtId,
      shipping.upazilaId,
      methodId,
      couponCode,
      quoteEmail,
      quoteNonce,
    ]);
  // Inputs the current quote already answers, with the shipping method the
  // server actually priced (its default when none was chosen yet).
  const quotedInputsRef = useRef<string | null>(null);

  useEffect(() => {
    if (!storeSlug || itemsKey === '[]') {
      setQuoteLoading(false);
      return;
    }
    // Adopting the server's default shipping method changes `shippingMethodId`,
    // but the quote we hold was already priced with that method: asking again
    // would only reopen a "still calculating" window for no reason.
    if (quotedInputsRef.current === quoteInputs(shippingMethodId)) {
      return;
    }
    let cancelled = false;
    let timedOut = false;
    const controller = new AbortController();
    setQuoteLoading(true);
    let deadline: number | undefined;
    const timer = window.setTimeout(async () => {
      const items = (JSON.parse(itemsKey) as [string, string | null, number][]).map(
        ([productId, variantId, quantity]) => ({ productId, variantId, quantity }),
      );
      deadline = window.setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, QUOTE_TIMEOUT_MS);
      try {
        const result = await publicPost<{
          success: true;
          data: PublicCheckoutQuote;
        }>(
          `/public/stores/${encodeURIComponent(storeSlug)}/checkout/quote`,
          {
            items,
            divisionId: shipping.divisionId || undefined,
            districtId: shipping.districtId || undefined,
            upazilaId: shipping.upazilaId || undefined,
            shippingMethodId: shippingMethodId || undefined,
            couponCode: couponCode || undefined,
            email: quoteEmail || undefined,
          },
          { signal: controller.signal },
        );
        if (cancelled) return;
        const data = result.data;
        quotedInputsRef.current = quoteInputs(data.shippingMethodId ?? '');
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
        quotedInputsRef.current = null;
        setQuote(null);
        setQuoteError(
          timedOut
            ? 'Calculating your total is taking too long. Check your connection and try again.'
            : err instanceof PublicApiError
              ? err.message
              : 'Could not calculate your order total. Please try again.',
        );
      } finally {
        window.clearTimeout(deadline);
        if (!cancelled) setQuoteLoading(false);
      }
    }, QUOTE_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.clearTimeout(deadline);
      controller.abort();
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

  // What the shopper can pay with right now, in display order. Before the
  // store's options load, Cash on delivery is assumed (checkout re-checks).
  const offlineOffered = useCallback(
    (provider: string, method: string) =>
      offlineOptions === null
        ? provider === 'COD'
        : offlineOptions.some((o) => o.provider === provider && o.method === method),
    [offlineOptions],
  );
  const offlineDetails = (method: string) =>
    offlineOptions?.find((o) => o.provider === 'OTHER' && o.method === method)?.details ?? null;
  const paymentChoices = useMemo(() => {
    const choices: { provider: PublicCheckoutPaymentProvider; method: PublicCheckoutPaymentMethod }[] = [];
    if (offlineOffered('COD', 'CASH') && codAllowedForMethod) choices.push({ provider: 'COD', method: 'CASH' });
    if (offlineOffered('OTHER', 'BANK_TRANSFER')) choices.push({ provider: 'OTHER', method: 'BANK_TRANSFER' });
    if (offlineOffered('OTHER', 'OTHER')) choices.push({ provider: 'OTHER', method: 'OTHER' });
    for (const provider of ['SSL_COMMERZ', 'STRIPE', 'TEST'] as const) {
      if (onlineProviders.some((p) => p.provider === provider)) choices.push({ provider, method: 'CARD' });
    }
    return choices;
  }, [offlineOffered, onlineProviders, codAllowedForMethod]);
  const paymentChoiceValid = paymentChoices.some(
    (c) => c.provider === paymentProvider && c.method === paymentMethod,
  );

  // Keep the selection on something the store offers (e.g. COD off, or not for this delivery method).
  useEffect(() => {
    if (paymentChoiceValid || paymentChoices.length === 0) return;
    setPaymentProvider(paymentChoices[0]!.provider);
    setPaymentMethod(paymentChoices[0]!.method);
  }, [paymentChoiceValid, paymentChoices]);

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

    if (!contactName.trim()) {
      setError('Please enter your name.');
      return;
    }
    if (!phone.trim()) {
      setError('A phone number is required to place this order.');
      return;
    }
    if (!isValidPhone(phone)) {
      setError('Enter a valid phone number, for example 01711000000.');
      return;
    }
    if (email.trim() && !EMAIL_PATTERN.test(email.trim())) {
      setError('Enter a valid email address, or leave it empty.');
      return;
    }
    if (!shipping.addressLine1.trim() || !shipping.country.trim()) {
      setError('Enter your full delivery address.');
      return;
    }
    if (!shipping.divisionId || !shipping.districtId || !shipping.upazilaId) {
      setError('Select your district and thana / upazila for delivery.');
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
    if (!paymentChoiceValid) {
      setError('This store has no payment option for this order. Please contact the store.');
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
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
        },
        shippingAddress: {
          name: shipping.name.trim() || contactName.trim(),
          phone: shipping.phone.trim() || phone.trim() || undefined,
          email: email.trim() || undefined,
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
              email: email.trim() || undefined,
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

      // The confirmation and payment pages load the order with this; it stays out of URLs.
      rememberOrderContact(storeSlug, result.data.publicReference, { email, phone });

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
          ...contactProof({ email, phone }),
        });
        clear();
        idempotencyKeyRef.current = null;
        if (initiated.data.redirectUrl) {
          window.location.href = initiated.data.redirectUrl;
          return;
        }
        router.push(
          `/payment/success?store=${encodeURIComponent(storeSlug)}&order=${encodeURIComponent(result.data.publicReference)}&ref=${encodeURIComponent(initiated.data.internalReference)}`,
        );
        return;
      }

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
      if (err instanceof PublicApiError && err.code === 'CHECKOUT_TOTAL_CHANGED') {
        // No order was created; show the current total before the customer retries.
        setQuoteNonce((value) => value + 1);
      }
      // Keep the same idempotency key so retries do not create duplicates.
    } finally {
      setSubmitting(false);
    }
  }

  const imageByLine = new Map(lines.map((line) => [lineKey(line), line.imageUrl]));
  const hasOnline = (provider: string) => onlineProviders.some((p) => p.provider === provider);

  return (
    <form
      id={formId}
      onSubmit={onSubmit}
      className="grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(300px,0.9fr)]"
      noValidate
    >
      <div className="space-y-6">
        <section className={sectionClass}>
          <StepHeading step={1} title="Delivery details" hint="Where should we send your order?" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name">
              <input
                className={inputClass}
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                autoComplete="name"
                placeholder="Your name"
                required
                aria-required
              />
            </Field>
            <Field label="Phone">
              <input
                type="tel"
                inputMode="tel"
                className={inputClass}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoComplete="tel"
                placeholder="01XXXXXXXXX"
                required
                aria-required
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Email (optional)">
                <input
                  type="email"
                  inputMode="email"
                  className={inputClass}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  placeholder="you@example.com — for order updates"
                />
              </Field>
            </div>
            <Field label="District">
              <select
                className={inputClass}
                value={shipping.districtId}
                onChange={(e) => {
                  const district = districts.find((d) => d.id === e.target.value);
                  setShipping((prev) => ({
                    ...prev,
                    districtId: e.target.value,
                    divisionId: district?.divisionId ?? '',
                    upazilaId: '',
                  }));
                }}
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
            <Field label="Thana / Upazila">
              <select
                className={inputClass}
                value={shipping.upazilaId}
                onChange={(e) => updateShipping('upazilaId', e.target.value)}
                disabled={!shipping.districtId}
                required
              >
                <option value="">
                  {shipping.districtId ? 'Select thana…' : 'Select district first'}
                </option>
                {upazilas.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </Field>
            <div className="sm:col-span-2">
              <Field label="Full address">
                <textarea
                  className={`${inputClass} min-h-[76px] resize-y`}
                  value={shipping.addressLine1}
                  onChange={(e) => updateShipping('addressLine1', e.target.value)}
                  required
                  autoComplete="street-address"
                  placeholder="House, road, area, nearby landmark"
                  maxLength={200}
                />
              </Field>
            </div>
          </div>

          <div className="space-y-4 border-t border-[var(--color-border)] pt-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[var(--color-accent)]"
                checked={billingSame}
                onChange={(e) => setBillingSame(e.target.checked)}
              />
              Billing address same as shipping
            </label>
            {!billingSame ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Billing name">
                  <input
                    className={inputClass}
                    value={billing.name}
                    onChange={(e) => updateBilling('name', e.target.value)}
                    placeholder="Defaults to your name"
                  />
                </Field>
                <Field label="Billing city">
                  <input
                    className={inputClass}
                    value={billing.city}
                    onChange={(e) => updateBilling('city', e.target.value)}
                  />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Billing address">
                    <input
                      className={inputClass}
                      value={billing.addressLine1}
                      onChange={(e) => updateBilling('addressLine1', e.target.value)}
                      required
                    />
                  </Field>
                </div>
              </div>
            ) : null}
            {allowOrderNotes ? (
              <Field label="Order note (optional)">
                <textarea
                  className={`${inputClass} min-h-16 resize-y`}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={2000}
                  placeholder="Anything the seller should know?"
                />
              </Field>
            ) : null}
          </div>
        </section>

        <section className={sectionClass}>
          <StepHeading
            step={2}
            title="Delivery method"
            hint={
              quoteZoneName
                ? `Delivery zone: ${quoteZoneName}`
                : shipping.upazilaId
                  ? undefined
                  : 'Choose your district and thana to see delivery charges.'
            }
          />
          {shippingLoadError ? (
            <p className="text-sm text-[var(--color-danger)]" role="alert">
              {shippingLoadError}
            </p>
          ) : null}
          {shippingMethods.length === 0 && !shippingLoadError ? (
            <p className="rounded-xl border border-dashed border-[var(--color-border)] px-4 py-5 text-center text-sm text-[var(--color-muted)]">
              No delivery options are available for this location yet.
            </p>
          ) : (
            <fieldset className="grid gap-3">
              <legend className="sr-only">Shipping method</legend>
              {shippingMethods.map((method) => {
                const amount = method.amount ?? method.price;
                const free =
                  method.freeShippingApplied ||
                  method.type === 'FREE' ||
                  amount === '0.00';
                const details = [
                  method.estimatedDelivery,
                  method.description,
                  method.freeShippingApplied ? 'Free shipping applied' : null,
                  method.codAllowed === false ? 'COD not available' : null,
                ].filter(Boolean);
                return (
                  <OptionTile
                    key={method.id}
                    name="shipping-method"
                    checked={shippingMethodId === method.id}
                    onSelect={() => setShippingMethodId(method.id)}
                    icon="truck"
                    title={method.name}
                    description={details.length ? details.join(' · ') : undefined}
                    aside={free ? 'Free' : formatMoney(amount, currency)}
                  />
                );
              })}
            </fieldset>
          )}
        </section>

        <section className={sectionClass}>
          <StepHeading step={3} title="Payment" hint="All transactions are secure." />
          <fieldset className="grid gap-3">
            <legend className="sr-only">Payment method</legend>
            {offlineOptions !== null && paymentChoices.length === 0 ? (
              <p role="alert" className="rounded-xl border border-dashed border-[var(--color-border)] px-4 py-5 text-center text-sm text-[var(--color-muted)]">
                No payment option is available for this delivery method. Please choose another delivery method or contact the store.
              </p>
            ) : null}
            {offlineOffered('COD', 'CASH') ? (
            <OptionTile
              name="pay"
              checked={paymentProvider === 'COD' && paymentMethod === 'CASH'}
              disabled={!codAllowedForMethod}
              onSelect={() => {
                setPaymentProvider('COD');
                setPaymentMethod('CASH');
              }}
              icon="cash"
              title="Cash on delivery"
              description={
                codAllowedForMethod
                  ? 'Pay in cash when your order arrives.'
                  : 'Not available for the selected delivery method.'
              }
            />
            ) : null}
            {hasOnline('SSL_COMMERZ') ? (
              <OptionTile
                name="pay"
                checked={paymentProvider === 'SSL_COMMERZ'}
                onSelect={() => {
                  setPaymentProvider('SSL_COMMERZ');
                  setPaymentMethod('CARD');
                }}
                icon="wallet"
                title="Pay online"
                description="Mobile banking, cards or net banking via SSLCommerz."
                badges={['bKash', 'Nagad', 'Rocket', 'Visa', 'Mastercard']}
              />
            ) : null}
            {hasOnline('STRIPE') ? (
              <OptionTile
                name="pay"
                checked={paymentProvider === 'STRIPE'}
                onSelect={() => {
                  setPaymentProvider('STRIPE');
                  setPaymentMethod('CARD');
                }}
                icon="card"
                title="Pay with card"
                description="Secure card payment with Stripe."
                badges={['Visa', 'Mastercard', 'Amex']}
              />
            ) : null}
            {hasOnline('TEST') ? (
              <OptionTile
                name="pay"
                checked={paymentProvider === 'TEST'}
                onSelect={() => {
                  setPaymentProvider('TEST');
                  setPaymentMethod('CARD');
                }}
                icon="card"
                title="Online test payment"
                description="Simulated payment for testing. No money is charged."
              />
            ) : null}
            {offlineOffered('OTHER', 'BANK_TRANSFER') ? (
              <OptionTile
                name="pay"
                checked={paymentProvider === 'OTHER' && paymentMethod === 'BANK_TRANSFER'}
                onSelect={() => {
                  setPaymentProvider('OTHER');
                  setPaymentMethod('BANK_TRANSFER');
                }}
                icon="bank"
                title="Bank transfer"
                description="Transfer to the store’s bank account; the store confirms your payment."
              />
            ) : null}
            {paymentProvider === 'OTHER' && paymentMethod === 'BANK_TRANSFER' && offlineDetails('BANK_TRANSFER') ? (
              <PaymentDetails title="Send your payment to">{offlineDetails('BANK_TRANSFER')}</PaymentDetails>
            ) : null}
            {offlineOffered('OTHER', 'OTHER') ? (
              <OptionTile
                name="pay"
                checked={paymentProvider === 'OTHER' && paymentMethod === 'OTHER'}
                onSelect={() => {
                  setPaymentProvider('OTHER');
                  setPaymentMethod('OTHER');
                }}
                icon="store"
                title="Other payment"
                description="Arrange payment directly with the store."
              />
            ) : null}
            {paymentProvider === 'OTHER' && paymentMethod === 'OTHER' && offlineDetails('OTHER') ? (
              <PaymentDetails title="How to pay">{offlineDetails('OTHER')}</PaymentDetails>
            ) : null}
          </fieldset>
        </section>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 sm:p-6">
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
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={quoteLoading}
                  onClick={() => setQuoteNonce((value) => value + 1)}
                >
                  {quoteLoading ? 'Retrying…' : 'Try again'}
                </Button>
                <Link
                  href={`/cart?store=${encodeURIComponent(storeSlug)}`}
                  className="text-[var(--color-accent)] hover:underline"
                >
                  Review your cart
                </Link>
              </div>
            </div>
          ) : null}
          {quote ? (
            <>
              <ul className="mt-4 space-y-3" aria-busy={quoteLoading}>
                {quote.lines.map((line) => {
                  const imageUrl = imageByLine.get(lineKey(line));
                  return (
                    <li key={lineKey(line)} className="flex gap-3 text-sm">
                      <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]">
                        {imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={imageUrl} alt="" className="h-full w-full object-cover" />
                        ) : null}
                        <span className="absolute -right-0 -top-0 flex h-5 min-w-5 items-center justify-center rounded-bl-lg bg-[var(--color-ink)] px-1 text-[11px] font-semibold text-white">
                          {line.quantity}
                        </span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex justify-between gap-3">
                          <span>
                            {line.productName}
                            {line.variantName ? ` · ${line.variantName}` : ''} × {line.quantity}
                          </span>
                          <span className="shrink-0 font-medium">
                            {formatMoney(line.lineTotal, quote.currency)}
                          </span>
                        </span>
                        <span className="block text-xs text-[var(--color-muted)]">
                          {formatMoney(line.unitPrice, quote.currency)} each
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>

              <div className="mt-4 border-t border-[var(--color-border)] pt-4">
                <div className="flex gap-2">
                  <input
                    className={inputClass}
                    value={couponDraft}
                    onChange={(e) => setCouponDraft(e.target.value.toUpperCase())}
                    placeholder="Coupon code"
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
                    className={`mt-2 text-sm ${couponCode ? 'text-[var(--color-muted)]' : 'text-red-700'}`}
                    role="status"
                  >
                    {couponMessage}
                  </p>
                ) : null}
              </div>

              <dl className="mt-4 space-y-2 border-t border-[var(--color-border)] pt-4 text-sm">
                <div className="flex justify-between">
                  <dt className="text-[var(--color-muted)]">Subtotal</dt>
                  <dd>{formatMoney(quote.subtotal, quote.currency)}</dd>
                </div>
                {quote.couponCode ? (
                  <div className="flex justify-between text-[var(--color-muted)]">
                    <dt>Discount ({quote.couponCode})</dt>
                    <dd>−{formatMoney(quote.discountTotal, quote.currency)}</dd>
                  </div>
                ) : null}
                <div className="flex justify-between">
                  <dt className="text-[var(--color-muted)]">Shipping</dt>
                  <dd>{formatMoney(quote.shippingTotal, quote.currency)}</dd>
                </div>
                <div className="flex items-baseline justify-between border-t border-[var(--color-border)] pt-3 text-base font-semibold">
                  <dt>Total</dt>
                  <dd className="text-xl">{formatMoney(quote.total, quote.currency)}</dd>
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
            <p
              className="mt-4 rounded-lg border border-[color-mix(in_srgb,var(--color-danger)_35%,transparent)] bg-[color-mix(in_srgb,var(--color-danger)_8%,transparent)] px-3 py-2 text-sm text-[var(--color-danger)]"
              role="alert"
            >
              {error}
            </p>
          ) : null}

          <Button
            type="submit"
            className="mt-4 w-full py-3 text-base"
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
