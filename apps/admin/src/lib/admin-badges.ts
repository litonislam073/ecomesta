'use client';

import { useCallback, useEffect, useState } from 'react';
import type { AdminBadges } from '@ecomesta/types';
import { api } from '@/lib/api-client';

/** Fired after something that changes a counter (Users opened, a payment reviewed). */
export const ADMIN_BADGES_EVENT = 'ecomesta:admin-badges';

const POLL_MS = 30_000;

/** Tells the sidebar to refresh its counters now. */
export function refreshAdminBadges(): void {
  window.dispatchEvent(new Event(ADMIN_BADGES_EVENT));
}

/**
 * Sidebar counters by nav link. Refreshed every 30 s, when the tab comes back
 * into view and right after a review. Failures keep the last numbers.
 */
export function useAdminBadges(): Record<string, number> {
  const [badges, setBadges] = useState<AdminBadges | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await api.get<{ success: true; data: AdminBadges }>('/admin/badges');
      setBadges(res.data);
    } catch {
      /* keep the last numbers */
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    const onEvent = () => void refresh();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener(ADMIN_BADGES_EVENT, onEvent);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener(ADMIN_BADGES_EVENT, onEvent);
    };
  }, [refresh]);

  return {
    '/dashboard/users': badges?.newUsers ?? 0,
    '/dashboard/payments': badges?.pendingPayments ?? 0,
    '/dashboard/theme-purchases': badges?.pendingThemePurchases ?? 0,
  };
}

/** "5", or "99+" for large numbers. */
export function badgeText(count: number): string {
  return count > 99 ? '99+' : String(count);
}
