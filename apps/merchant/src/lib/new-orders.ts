'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import { useOptionalStoreContext } from '@/lib/store-context';

/** Fired after an order is opened, so the Orders badge updates at once. */
export const ORDERS_VIEWED_EVENT = 'ecomesta:orders-viewed';

const POLL_MS = 30_000;

/**
 * Orders nobody on the store's team has opened yet, for the Orders badge.
 * Refreshed every 30 s, when the tab comes back into view and right after an
 * order is opened. Failures keep the last number (the badge is a hint).
 */
export function useNewOrdersCount(): number {
  const selectedStoreId = useOptionalStoreContext()?.selectedStoreId ?? null;
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!selectedStoreId) return;
    try {
      const res = await api.get<{ success: true; data: { count: number } }>(
        `/stores/${selectedStoreId}/orders/unviewed-count`,
      );
      setCount(res.data.count);
    } catch {
      /* keep the last count */
    }
  }, [selectedStoreId]);

  useEffect(() => {
    setCount(0);
    if (!selectedStoreId) return;
    void refresh();
    const timer = window.setInterval(() => void refresh(), POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    const onViewed = () => void refresh();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener(ORDERS_VIEWED_EVENT, onViewed);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener(ORDERS_VIEWED_EVENT, onViewed);
    };
  }, [selectedStoreId, refresh]);

  return count;
}

/** "5", or "99+" for large numbers. */
export function badgeText(count: number): string {
  return count > 99 ? '99+' : String(count);
}
