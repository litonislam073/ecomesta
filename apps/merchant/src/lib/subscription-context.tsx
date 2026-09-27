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
import type { MerchantSubscription, PublicPlan } from '@ecomesta/types';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';

interface SubscriptionContextValue {
  data: MerchantSubscription | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  setData: (data: MerchantSubscription) => void;
}

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { accessToken, user } = useAuth();
  const [data, setData] = useState<MerchantSubscription | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!accessToken) {
      setData(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await api.get<{ success: true; data: MerchantSubscription }>(
        '/billing/subscription',
        { token: accessToken },
      );
      setData(result.data);
    } catch (err) {
      setData(null);
      setError(err instanceof Error ? err.message : 'Could not load your subscription');
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  const hasTenant = Boolean(user && user.memberships.tenants.length > 0);
  useEffect(() => {
    if (hasTenant) void refresh();
  }, [hasTenant, refresh]);

  const value = useMemo(
    () => ({ data, loading, error, refresh, setData }),
    [data, loading, error, refresh],
  );
  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}

const NO_SUBSCRIPTION: SubscriptionContextValue = {
  data: null,
  loading: false,
  error: null,
  refresh: async () => {},
  setData: () => {},
};

/** Outside the dashboard shell (e.g. isolated page tests) this reports no subscription. */
export function useSubscription(): SubscriptionContextValue {
  return useContext(SubscriptionContext) ?? NO_SUBSCRIPTION;
}

/** Active plans with BDT prices (public, no auth). */
export function usePublicPlans() {
  const [plans, setPlans] = useState<PublicPlan[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    api
      .get<{ success: true; data: PublicPlan[] }>('/public/plans', {
        token: null,
        signal: controller.signal,
      })
      .then((result) => setPlans(result.data))
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : 'Could not load plans');
        setPlans([]);
      });
    return () => controller.abort();
  }, []);

  return { plans, error };
}
