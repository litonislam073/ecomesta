import type { PublicCheckoutQuote, PublicShippingMethod } from '@ecomesta/types';

/** Test-only: builds a checkout quote the way the API prices a request body. */
export function quoteFor(
  body: unknown,
  options: {
    methods?: PublicShippingMethod[];
    prices?: Record<string, string>;
    zoneName?: string;
    discount?: string;
    couponError?: string;
    currency?: string;
  } = {},
): { success: true; data: PublicCheckoutQuote } {
  const request = (body ?? {}) as {
    items?: { productId: string; variantId?: string | null; quantity: number }[];
    shippingMethodId?: string;
    divisionId?: string;
    couponCode?: string;
  };
  const methods = options.methods ?? [];
  const cents = (value: string) => Math.round(Number(value) * 100);
  const money = (value: number) => (value / 100).toFixed(2);

  const lines = (request.items ?? []).map((item) => {
    const unitPrice = options.prices?.[item.productId] ?? '10.00';
    return {
      productId: item.productId,
      variantId: item.variantId ?? null,
      productName: 'Widget',
      variantName: null,
      quantity: item.quantity,
      unitPrice,
      lineTotal: money(cents(unitPrice) * item.quantity),
    };
  });
  const subtotal = lines.reduce((sum, line) => sum + cents(line.lineTotal), 0);
  const couponApplies = Boolean(request.couponCode) && !options.couponError;
  const discount = couponApplies ? cents(options.discount ?? '0.00') : 0;
  const selected =
    methods.find((m) => m.id === request.shippingMethodId) ?? methods[0] ?? null;
  const shipping = selected ? cents(selected.amount ?? selected.price) : 0;

  return {
    success: true,
    data: {
      currency: options.currency ?? 'BDT',
      lines,
      subtotal: money(subtotal),
      couponCode: couponApplies ? request.couponCode!.toUpperCase() : null,
      couponError: request.couponCode ? (options.couponError ?? null) : null,
      discountTotal: money(discount),
      zone:
        request.divisionId && options.zoneName
          ? { id: 'z1', name: options.zoneName, priority: 100 }
          : null,
      shippingMethods: methods,
      shippingMethodId: selected?.id ?? null,
      shippingTotal: money(shipping),
      taxTotal: '0.00',
      total: money(subtotal - discount + shipping),
    },
  };
}
