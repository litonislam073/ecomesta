import { describe, expect, it } from 'vitest';
import { addMoney, formatMoney, multiplyMoney } from '@/lib/money';
import { lineKey } from '@/lib/cart';

describe('money helpers', () => {
  it('formats currency', () => {
    expect(formatMoney('19.99', 'USD')).toMatch(/19\.99/);
  });

  it('multiplies and adds without float drift for cents', () => {
    expect(multiplyMoney('10.50', 2)).toBe('21.00');
    expect(addMoney('19.99', '0.01')).toBe('20.00');
  });
});

describe('cart line keys', () => {
  it('isolates product and variant keys', () => {
    expect(lineKey({ productId: 'p1', variantId: null })).toBe('p1:base');
    expect(lineKey({ productId: 'p1', variantId: 'v1' })).toBe('p1:v1');
  });
});
