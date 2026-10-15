'use client';

import { useCallback, useEffect, useState } from 'react';
import type { StoreAnalytics } from '@ecomesta/types';
import { ApiError, api } from '@/lib/api-client';

export type RangePreset = 'today' | '7d' | '30d' | '90d' | '12m' | 'custom';

export const RANGE_PRESETS: { value: RangePreset; label: string; days: number | null; full: boolean }[] = [
  { value: 'today', label: 'Today', days: 1, full: false },
  { value: '7d', label: 'Last 7 days', days: 7, full: false },
  { value: '30d', label: 'Last 30 days', days: 30, full: false },
  { value: '90d', label: 'Last 90 days', days: 90, full: true },
  { value: '12m', label: 'Last 12 months', days: 365, full: true },
  { value: 'custom', label: 'Custom', days: null, full: true },
];

/** YYYY-MM-DD `days` before/after `date`. */
export function shiftDate(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!) + days * 86_400_000).toISOString().slice(0, 10);
}

export function todayInZone(timezone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

/** `from`/`to` query for a preset, in the store's time zone. */
export function presetRange(preset: RangePreset, timezone: string): { from: string; to: string } | null {
  const days = RANGE_PRESETS.find((p) => p.value === preset)?.days;
  if (!days) return null;
  const to = todayInZone(timezone);
  return { from: shiftDate(to, -(days - 1)), to };
}

export function formatMoney(amount: number, currency = 'BDT'): string {
  const symbol = currency === 'BDT' ? '৳' : `${currency} `;
  return `${symbol}${new Intl.NumberFormat('en-IN', { maximumFractionDigits: amount % 1 === 0 ? 0 : 2 }).format(amount)}`;
}

export function formatCount(value: number): string {
  return new Intl.NumberFormat('en-IN').format(value);
}

/** Percent change from `previous` to `current`; null when there is nothing to compare with. */
export function percentChange(current: number | null, previous: number | null): number | null {
  if (current == null || previous == null) return null;
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

const DAY_LABEL = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

export function dayLabel(date: string): string {
  return DAY_LABEL.format(new Date(`${date}T00:00:00Z`));
}

export function useStoreAnalytics(storeId: string | null, range: { from: string; to: string } | null) {
  const [data, setData] = useState<StoreAnalytics | null>(null);
  const [error, setError] = useState<{ message: string; upgrade: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const from = range?.from;
  const to = range?.to;

  const load = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    setError(null);
    try {
      const query = from && to ? `?from=${from}&to=${to}` : '';
      const res = await api.get<{ success: true; data: StoreAnalytics }>(`/stores/${storeId}/analytics${query}`);
      setData(res.data);
    } catch (err) {
      setError({
        message: err instanceof ApiError ? err.message : 'Could not load analytics.',
        upgrade: err instanceof ApiError && err.code === 'PLAN_UPGRADE_REQUIRED',
      });
    } finally {
      setLoading(false);
    }
  }, [storeId, from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, error, loading, reload: load };
}
