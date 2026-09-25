export function formatMoney(amount: string | number, currency: string, locale = 'en-US'): string {
  const value = typeof amount === 'number' ? amount : Number.parseFloat(amount);
  if (!Number.isFinite(value)) {
    return `${currency} ${amount}`;
  }
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency} ${Number(value).toFixed(2)}`;
  }
}

/** Exact cents math for cart display (server remains authoritative later). */
export function multiplyMoney(unitPrice: string, quantity: number): string {
  const cents = Math.round(Number.parseFloat(unitPrice) * 100);
  if (!Number.isFinite(cents) || quantity < 0) {
    return '0.00';
  }
  return ((cents * quantity) / 100).toFixed(2);
}

export function addMoney(a: string, b: string): string {
  const sum =
    Math.round(Number.parseFloat(a) * 100) + Math.round(Number.parseFloat(b) * 100);
  return (sum / 100).toFixed(2);
}
