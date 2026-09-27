'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { StoreSummary } from '@ecomesta/types';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';

const STORE_KEY = 'ecomesta.selectedStoreId';

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

export function StoreProvider({ children }: { children: ReactNode }) {
  const { accessToken, user } = useAuth();
  const [stores, setStores] = useState<StoreSummary[]>([]);
  const [selectedStoreId, setSelectedStoreIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshStores = useCallback(async () => {
    if (!accessToken) {
      setStores([]);
      setSelectedStoreIdState(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await api.get<{ success: true; data: StoreSummary[] }>(
        '/stores',
        { token: accessToken },
      );
      const nextStores = result.data;
      setStores(nextStores);

      const saved =
        typeof window !== 'undefined' ? window.sessionStorage.getItem(STORE_KEY) : null;
      const preferred =
        (saved && nextStores.some((store) => store.id === saved) ? saved : null) ??
        nextStores[0]?.id ??
        null;
      setSelectedStoreIdState(preferred);
      if (preferred && typeof window !== 'undefined') {
        window.sessionStorage.setItem(STORE_KEY, preferred);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stores');
      setStores([]);
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

export function useStoreContext() {
  const ctx = useContext(StoreContext);
  if (!ctx) {
    throw new Error('useStoreContext must be used within StoreProvider');
  }
  return ctx;
}
