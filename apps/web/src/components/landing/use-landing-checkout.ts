'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  BdLocationItem,
  PublicCheckoutConfirmation,
  PublicCheckoutPaymentMethod,
  PublicCheckoutPaymentProvider,
  PublicCheckoutQuote,
  PublicPaymentInitiation,
  PublicPaymentProvidersResponse,
} from '@ecomesta/types';
import { contactProof, rememberOrderContact } from '@/lib/order-contact';
import { publicGet, publicPost, PublicApiError } from '@/lib/public-api';
import { trackBeginCheckout, trackPurchase } from '@/lib/tracking';
import { linePrice, useLanding } from './landing-context';

export interface PaymentChoice {
  key: string;
  provider: PublicCheckoutPaymentProvider;
  method: PublicCheckoutPaymentMethod;
  label: string;
  hint: string;
}

export interface LandingOrderResult {
  name: string;
  phone: string;
  orderNumber: string;
  publicReference: string;
  total: number;
}

export type LandingFieldErrors = Partial<Record<'name' | 'phone' | 'address' | 'district' | 'upazila' | 'items' | 'shipping', string>>;

const QUOTE_DEBOUNCE_MS = 300;
const QUOTE_TIMEOUT_MS = 15_000;

/** 01XXXXXXXXX after dropping spaces, dashes and the +88 / 88 prefix. */
export function normalizeBdPhone(value: string): string {
  return value.replace(/[\s\-().]/g, '').replace(/^\+?88/, '');
}

export const BD_PHONE = /^01[3-9]\d{8}$/;

function choiceLabel(provider: string, method: string): { label: string; hint: string } {
  if (provider === 'COD') return { label: 'ক্যাশ অন ডেলিভারি', hint: 'পণ্য হাতে পেয়ে টাকা দিন' };
  if (provider === 'SSL_COMMERZ') return { label: 'অনলাইন পেমেন্ট', hint: 'SSLCommerz-এর মাধ্যমে' };
  if (provider === 'STRIPE') return { label: 'কার্ড পেমেন্ট', hint: 'Visa / Mastercard' };
  if (provider === 'TEST') return { label: 'টেস্ট পেমেন্ট', hint: 'শুধু পরীক্ষার জন্য' };
  if (method === 'BANK_TRANSFER') return { label: 'ব্যাংক ট্রান্সফার', hint: 'অর্ডারের পর তথ্য জানানো হবে' };
  return { label: 'অন্যভাবে পেমেন্ট', hint: 'অর্ডারের পর আমরা জানাবো' };
}

/**
 * The landing page order form's checkout: the shopper's district and thana,
 * the store's delivery options and payment methods, a server-priced quote
 * and placing the order (the same public checkout the store uses).
 */
export function useLandingCheckout() {
  const { store, page, lines, productById, demo, currency, preview } = useLanding();
  const storeSlug = store.slug;
  const enabled = !demo;

  const [districts, setDistricts] = useState<BdLocationItem[]>([]);
  const [upazilas, setUpazilas] = useState<BdLocationItem[]>([]);
  const [districtId, setDistrictId] = useState('');
  const [upazilaId, setUpazilaId] = useState('');
  const [providers, setProviders] = useState<PublicPaymentProvidersResponse | null>(null);
  const [paymentKey, setPaymentKey] = useState('COD:CASH');
  const [shippingMethodId, setShippingMethodId] = useState('');
  const [quote, setQuote] = useState<PublicCheckoutQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [result, setResult] = useState<LandingOrderResult | null>(null);
  const idempotencyKey = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void Promise.all([
      publicGet<{ success: true; data: PublicPaymentProvidersResponse }>(`/public/stores/${encodeURIComponent(storeSlug)}/payment-providers`),
      publicGet<{ success: true; data: BdLocationItem[] }>(`/public/stores/${encodeURIComponent(storeSlug)}/locations/districts`),
    ])
      .then(([paymentResult, districtResult]) => {
        if (cancelled) return;
        setProviders(paymentResult.data);
        setDistricts([...districtResult.data].sort((a, b) => a.name.localeCompare(b.name)));
      })
      .catch(() => {
        if (!cancelled) setFormError('অর্ডার ফর্ম লোড হয়নি। পেজটি আবার খুলুন।');
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, storeSlug]);

  useEffect(() => {
    setUpazilaId('');
    if (!districtId) {
      setUpazilas([]);
      return;
    }
    let cancelled = false;
    publicGet<{ success: true; data: BdLocationItem[] }>(
      `/public/stores/${encodeURIComponent(storeSlug)}/locations/upazilas?districtId=${encodeURIComponent(districtId)}`,
    )
      .then((r) => !cancelled && setUpazilas([...r.data].sort((a, b) => a.name.localeCompare(b.name))))
      .catch(() => !cancelled && setUpazilas([]));
    return () => {
      cancelled = true;
    };
  }, [districtId, storeSlug]);

  const district = districts.find((d) => d.id === districtId) ?? null;
  const itemsKey = JSON.stringify(lines.map((l) => [l.productId, l.variantId, l.quantity]));

  // Server-priced summary for exactly these products, place and delivery option.
  useEffect(() => {
    if (!enabled || lines.length === 0) {
      setQuote(null);
      setQuoteLoading(false);
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    setQuoteLoading(true);
    const deadline = window.setTimeout(() => controller.abort(), QUOTE_TIMEOUT_MS + QUOTE_DEBOUNCE_MS);
    const timer = window.setTimeout(() => {
      const items = (JSON.parse(itemsKey) as [string, string | null, number][]).map(([productId, variantId, quantity]) => ({ productId, variantId, quantity }));
      publicPost<{ success: true; data: PublicCheckoutQuote }>(
        `/public/stores/${encodeURIComponent(storeSlug)}/checkout/quote`,
        {
          items,
          divisionId: district?.divisionId || undefined,
          districtId: districtId || undefined,
          upazilaId: upazilaId || undefined,
          shippingMethodId: shippingMethodId || undefined,
        },
        { signal: controller.signal },
      )
        .then((r) => {
          if (cancelled) return;
          setQuote(r.data);
          setQuoteError(null);
          if ((r.data.shippingMethodId ?? '') !== shippingMethodId) setShippingMethodId(r.data.shippingMethodId ?? '');
        })
        .catch((err) => {
          if (cancelled) return;
          setQuote(null);
          setQuoteError(err instanceof PublicApiError ? err.message : 'দাম হিসাব করা যায়নি। আবার চেষ্টা করুন।');
        })
        .finally(() => {
          if (!cancelled) setQuoteLoading(false);
          window.clearTimeout(deadline);
        });
    }, QUOTE_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timer);
      window.clearTimeout(deadline);
    };
    // district is derived from districtId
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, itemsKey, storeSlug, districtId, upazilaId, shippingMethodId]);

  const shippingMethods = quote?.shippingMethods ?? [];
  const selectedShipping = shippingMethods.find((m) => m.id === shippingMethodId) ?? null;

  const paymentChoices = useMemo<PaymentChoice[]>(() => {
    const choices: PaymentChoice[] = [];
    const offline = providers?.offline ?? [{ provider: 'COD', method: 'CASH' }];
    const codAllowed = selectedShipping?.codAllowed !== false;
    for (const option of offline) {
      if (option.provider === 'COD' && !codAllowed) continue;
      if (!['COD', 'OTHER'].includes(option.provider)) continue;
      choices.push({ key: `${option.provider}:${option.method}`, provider: option.provider as PublicCheckoutPaymentProvider, method: option.method as PublicCheckoutPaymentMethod, ...choiceLabel(option.provider, option.method) });
    }
    for (const provider of ['SSL_COMMERZ', 'STRIPE', 'TEST'] as const) {
      if (providers?.online.some((p) => p.provider === provider)) {
        choices.push({ key: `${provider}:CARD`, provider, method: 'CARD', ...choiceLabel(provider, 'CARD') });
      }
    }
    return choices;
  }, [providers, selectedShipping]);

  useEffect(() => {
    if (paymentChoices.length > 0 && !paymentChoices.some((c) => c.key === paymentKey)) setPaymentKey(paymentChoices[0]!.key);
  }, [paymentChoices, paymentKey]);

  // Marketing tags: the shopper reached the order form with something to buy (once).
  const checkoutTracked = useRef(false);
  const reportCheckoutStarted = () => {
    if (checkoutTracked.current || preview || demo || lines.length === 0) return;
    checkoutTracked.current = true;
    const items = lines.map((l) => {
      const product = productById(l.productId);
      const { price, variantName } = linePrice(product, l.variantId);
      return { id: l.productId, name: product?.name ?? '', variant: variantName, price, quantity: l.quantity };
    });
    trackBeginCheckout(items, items.reduce((sum, i) => sum + i.price * i.quantity, 0), currency);
  };

  async function submit(input: { name: string; phone: string; address: string }): Promise<LandingFieldErrors | null> {
    setFormError(null);
    const errors: LandingFieldErrors = {};
    const name = input.name.trim();
    const phone = normalizeBdPhone(input.phone);
    const address = input.address.trim();
    if (lines.length === 0) errors.items = 'অন্তত একটি পণ্য বাছাই করুন';
    if (name.length < 2) errors.name = 'আপনার নাম লিখুন';
    if (!phone) errors.phone = 'মোবাইল নম্বর লিখুন';
    else if (!BD_PHONE.test(phone)) errors.phone = 'সঠিক ১১ ডিজিটের নম্বর দিন (যেমন 01712345678)';
    if (address.length < 6) errors.address = 'বাসা/রোড/এলাকাসহ পুরো ঠিকানা লিখুন';
    if (!districtId) errors.district = 'জেলা বাছাই করুন';
    if (!upazilaId) errors.upazila = 'থানা / উপজেলা বাছাই করুন';
    if (Object.keys(errors).length > 0) return errors;
    if (demo) {
      setFormError('এটি ডেমো পেজ। এডিটরে পণ্য বাছাই করলে অর্ডার নেওয়া যাবে।');
      return {};
    }
    if (!quote || quoteLoading || quoteError || !shippingMethodId) {
      if (!shippingMethodId && quote && shippingMethods.length === 0) {
        return { shipping: 'এই এলাকায় ডেলিভারি দেওয়া হয় না' };
      }
      // Button should stay disabled until ready; avoid treating wait as a failed submit.
      return {};
    }
    const choice = paymentChoices.find((c) => c.key === paymentKey);
    if (!choice) {
      setFormError('এই দোকানে এখন পেমেন্টের কোনো উপায় চালু নেই। দোকানে যোগাযোগ করুন।');
      return {};
    }

    idempotencyKey.current ??=
      typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `lp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setSubmitting(true);
    try {
      const upazila = upazilas.find((u) => u.id === upazilaId);
      const order = await publicPost<{ success: true; data: PublicCheckoutConfirmation }>(
        `/public/stores/${encodeURIComponent(storeSlug)}/checkout`,
        {
          items: lines.map((l) => ({ productId: l.productId, variantId: l.variantId, quantity: l.quantity })),
          customer: { name, phone },
          shippingAddress: {
            name,
            phone,
            addressLine1: address,
            addressLine2: upazila?.name,
            city: district?.name ?? 'N/A',
            country: 'BD',
            divisionId: district?.divisionId,
            districtId,
            upazilaId,
          },
          billingSameAsShipping: true,
          shippingMethodId,
          paymentProvider: choice.provider,
          paymentMethod: choice.method,
          expectedTotal: quote.total,
          landingPageId: page.preview ? undefined : page.id,
        },
        { idempotencyKey: idempotencyKey.current },
      );
      const confirmation = order.data;
      rememberOrderContact(storeSlug, confirmation.publicReference, { email: '', phone });
      const total = Number(quote.total);

      if (choice.provider === 'SSL_COMMERZ' || choice.provider === 'STRIPE' || choice.provider === 'TEST') {
        const initiated = await publicPost<{ success: true; data: PublicPaymentInitiation }>(
          `/public/stores/${encodeURIComponent(storeSlug)}/payments/create`,
          { publicReference: confirmation.publicReference, provider: choice.provider, ...contactProof({ email: '', phone }) },
        );
        idempotencyKey.current = null;
        if (initiated.data.redirectUrl) {
          window.location.href = initiated.data.redirectUrl;
          return null;
        }
        window.location.href = `/payment/success?store=${encodeURIComponent(storeSlug)}&order=${encodeURIComponent(confirmation.publicReference)}&ref=${encodeURIComponent(initiated.data.internalReference)}`;
        return null;
      }

      trackPurchase(
        confirmation.publicReference,
        quote.lines.map((l) => ({ id: l.productId, name: l.productName, variant: l.variantName, price: Number(l.unitPrice), quantity: l.quantity })),
        total,
        quote.currency,
      );
      idempotencyKey.current = null;
      setResult({ name, phone, orderNumber: confirmation.orderNumber, publicReference: confirmation.publicReference, total });
      return null;
    } catch (err) {
      setFormError(
        err instanceof PublicApiError
          ? err.code === 'CHECKOUT_TOTAL_CHANGED'
            ? 'দাম পরিবর্তন হয়েছে। নতুন মোট দাম দেখে আবার অর্ডার করুন।'
            : err.message
          : 'দুঃখিত, অর্ডার পাঠানো যায়নি। একটু পরে আবার চেষ্টা করুন অথবা আমাদের কল করুন।',
      );
      return {};
    } finally {
      setSubmitting(false);
    }
  }

  return {
    enabled,
    districts,
    upazilas,
    districtId,
    setDistrictId,
    upazilaId,
    setUpazilaId,
    shippingMethods,
    shippingMethodId,
    setShippingMethodId,
    selectedShipping,
    paymentChoices,
    paymentKey,
    setPaymentKey,
    quote,
    quoteLoading,
    quoteError,
    submitting,
    formError,
    result,
    submit,
    reportCheckoutStarted,
  };
}
