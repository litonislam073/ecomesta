'use client';

import { useCallback, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

/**
 * Keeps a tab/filter value in the URL (`?tab=…` or a custom key) so the view
 * can be bookmarked and shared.
 */
export function useQueryTab<T extends string>(
  allowed: readonly T[],
  fallback: T,
  key = 'tab',
): [T, (next: T) => void] {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const value = useMemo(() => {
    const raw = searchParams.get(key);
    return raw && (allowed as readonly string[]).includes(raw) ? (raw as T) : fallback;
  }, [allowed, fallback, key, searchParams]);

  const setValue = useCallback(
    (next: T) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === fallback) params.delete(key);
      else params.set(key, next);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [fallback, key, pathname, router, searchParams],
  );

  return [value, setValue];
}
