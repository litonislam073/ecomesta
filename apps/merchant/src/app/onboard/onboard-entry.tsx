'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import OnboardForm from './onboard-form';
import { ReopenStoreForm, type ReusableBusiness } from './reopen-store-form';

function isBusiness(value: unknown): value is ReusableBusiness {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    typeof (value as { name?: unknown }).name === 'string'
  );
}

/**
 * A merchant whose store was deleted reopens it in the same business (no
 * payment). Everyone else sees the normal sign-up form straight away; it is
 * only swapped out once the API says there is a business to reuse.
 */
export default function OnboardEntry() {
  const { user, loading } = useAuth();
  const [business, setBusiness] = useState<ReusableBusiness | null>(null);

  useEffect(() => {
    if (loading || !user) return;
    let cancelled = false;
    api
      .get<{ success: true; data: unknown }>('/onboarding/existing-business')
      .then((res) => {
        if (!cancelled && isBusiness(res?.data)) setBusiness(res.data);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [loading, user]);

  return business ? <ReopenStoreForm business={business} /> : <OnboardForm />;
}
