import type { PublicStore } from '@ecomesta/types';

/** Customer-facing payment badges from the store's enabled methods. */
export function storePaymentLabels(store: PublicStore): string[] {
  const labels: string[] = [];
  const offline = store.payments?.offline ?? [];
  const online = store.payments?.online ?? [];

  if (offline.includes('COD')) labels.push('Cash on delivery');
  if (offline.includes('BANK_TRANSFER')) labels.push('Bank transfer');
  if (offline.includes('OTHER')) labels.push('Other payment');
  if (online.includes('SSL_COMMERZ')) {
    labels.push('bKash', 'Nagad', 'Cards');
  } else if (online.includes('STRIPE')) {
    labels.push('Cards');
  }
  // Never show TEST to shoppers.
  return labels;
}
