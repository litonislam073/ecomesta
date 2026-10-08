'use client';

import { useEffect } from 'react';
import { trackViewItem } from '@/lib/tracking';

/** Marketing tags: the shopper opened this product. */
export function TrackProductView({
  id,
  sku,
  name,
  price,
  currency,
}: {
  id: string;
  sku: string | null;
  name: string;
  price: string;
  currency: string;
}) {
  useEffect(() => {
    trackViewItem({ id: sku || id, name, price: Number(price), quantity: 1 }, currency);
  }, [id, sku, name, price, currency]);
  return null;
}
