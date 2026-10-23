'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { StoreSummary } from '@ecomesta/types';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';

const STORE_KEY = 'ecomesta.selectedStoreId';
const STORES_CACHE_KEY = 'ecomesta.storesCache';
/** Soft cache so hard reloads can paint page data before /stores returns. */
const STORES_CACHE_TTL_MS = 60_000;

interface StoresCachePayload {
  at: number;
  stores: StoreSummary[];
}

interface StoreContextValue {
  stores: StoreSummary[];
  selectedStore: StoreSummary | null;
  selectedStoreId: string | null;
  loading: boolean;
  error: string | null;
  setSelectedStoreId: (storeId: string) => void;
  refreshStores: () => Promise<void>;
}

const StoreContext = createContext<StoreContextValue | null>(null);

function readStoresCache(): StoreSummary[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(STORES_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoresCachePayload;
    if (!parsed?.stores || !Array.isArray(parsed.stores)) return null;
    if (Date.now() - parsed.at > STORES_CACHE_TTL_MS) return null;
    return parsed.stores;
  } catch {
    return null;
  }
}

function writeStoresCache(stores: StoreSummary[]) {
  if (typeof window === 'undefined') return;
  try {
    const payload: StoresCachePayload = { at: Date.now(), stores };
    window.sessionStorage.setItem(STORES_CACHE_KEY, JSON.stringify(payload));
  } catch {
    /* ignore quota */
  }
}

function pickPreferredStoreId(stores: StoreSummary[]): string | null {
  const saved =
    typeof window !== 'undefined' ? window.sessionStorage.getItem(STORE_KEY) : null;
  return (
    (saved && stores.some((store) => store.id === saved) ? saved : null) ??
    stores[0]?.id ??
    null
  );
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const { accessToken, user } = useAuth();
  const [stores, setStores] = useState<StoreSummary[]>([]);
  const [selectedStoreId, setSelectedStoreIdState] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return window.sessionStorage.getItem(STORE_KEY);
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hydratedFromCache, setHydratedFromCache] = useState(false);
  const storesRef = useRef(stores);
  storesRef.current = stores;

  // Warm from session cache as soon as we have a token, so pages don't wait on /stores.
  useEffect(() => {
    if (!accessToken || hydratedFromCache) return;
    const cached = readStoresCache();
    if (cached && cached.length > 0) {
      setStores(cached);
      const preferred = pickPreferredStoreId(cached);
      setSelectedStoreIdState(preferred);
      if (preferred) window.sessionStorage.setItem(STORE_KEY, preferred);
    }
    setHydratedFromCache(true);
  }, [accessToken, hydratedFromCache]);

  const refreshStores = useCallback(async () => {
    if (!accessToken) {
      setStores([]);
      setSelectedStoreIdState(null);
      return;
    }

    // Keep showing cached stores while refreshing; only block when we have none.
    const hasCached = storesRef.current.length > 0;
    if (!hasCached) setLoading(true);
    setError(null);
    try {
      const result = await api.get<{ success: true; data: StoreSummary[] }>(
        '/stores',
        { token: accessToken },
      );
      const nextStores = result.data;
      setStores(nextStores);
      writeStoresCache(nextStores);

      const preferred = pickPreferredStoreId(nextStores);
      setSelectedStoreIdState(preferred);
      if (preferred && typeof window !== 'undefined') {
        window.sessionStorage.setItem(STORE_KEY, preferred);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stores');
      if (!hasCached) setStores([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  // Re-fetch when memberships change (e.g. after first-store onboarding).
  // accessToken/user.id alone stay the same across that flow.
  const storeMembershipKey =
    user?.memberships.stores
      .map((membership) => membership.storeId)
      .sort()
      .join(',') ?? '';

  useEffect(() => {
    void refreshStores();
  }, [refreshStores, user?.id, storeMembershipKey]);

  const setSelectedStoreId = useCallback(
    (storeId: string) => {
      if (!stores.some((store) => store.id === storeId)) {
        return;
      }
      setSelectedStoreIdState(storeId);
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(STORE_KEY, storeId);
      }
    },
    [stores],
  );

  const selectedStore =
    stores.find((store) => store.id === selectedStoreId) ?? null;

  const value = useMemo(
    () => ({
      stores,
      selectedStore,
      selectedStoreId,
      loading,
      error,
      setSelectedStoreId,
      refreshStores,
    }),
    [
      stores,
      selectedStore,
      selectedStoreId,
      loading,
      error,
      setSelectedStoreId,
      refreshStores,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

/** The store context, or null outside a StoreProvider (for optional extras such as badges). */
export function useOptionalStoreContext() {
  return useContext(StoreContext);
}

export function useStoreContext() {
  const ctx = useContext(StoreContext);
  if (!ctx) {
    throw new Error('useStoreContext must be used within StoreProvider');
  }
  return ctx;
}
