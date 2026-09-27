'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import type { Coupon, CouponType } from '@ecomesta/types';
import { Button } from '@ecomesta/ui';
import {
  CouponFormFields,
  emptyCouponForm,
  type CouponFormState,
} from '@/components/coupons/coupon-form-fields';
import { StoreScoped } from '@/components/catalog/store-scoped';
import { EmptyState } from '@/components/ui/empty-state';
import { useToast } from '@/components/ui/toast';
import { ApiError, api } from '@/lib/api-client';
import { humanApiError } from '@/lib/catalog-utils';
import { useCanManageStore } from '@/lib/permissions';
import { useStoreContext } from '@/lib/store-context';
function NewCouponContent() {
  const router = useRouter();
  const { selectedStoreId } = useStoreContext();
  const canWrite = useCanManageStore();
  const { pushToast } = useToast();
  const [form, setForm] = useState<CouponFormState>(emptyCouponForm());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!selectedStoreId || !canWrite) return;
    setBusy(true);
    setError(null);
    try {
      const created = await api.post<{ success: true; data: Coupon }>(
        `/stores/${selectedStoreId}/coupons`,
        {
          code: form.code.trim().toUpperCase(),
          type: form.type as CouponType,
          value: form.value,
          active: form.active,
          startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
          expiresAt: form.expiresAt
            ? new Date(form.expiresAt).toISOString()
            : null,
          usageLimit: form.usageLimit ? Number(form.usageLimit) : null,
          perCustomerLimit: form.perCustomerLimit
            ? Number(form.perCustomerLimit)
            : null,
          minimumOrderAmount: form.minimumOrderAmount || null,
          maximumDiscountAmount: form.maximumDiscountAmount || null,
        },
      );
      pushToast('Coupon created', 'success');
      router.push(`/dashboard/coupons/${created.data.id}`);
    } catch (err) {
      setError(humanApiError(err, 'Could not create coupon'));
      if (err instanceof ApiError) pushToast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  if (!selectedStoreId) {
    return (
      <EmptyState
        title="Select a store"
        description="Choose a store from the header to manage coupons."
      />
    );
  }
  if (!canWrite) {
    return (
      <EmptyState
        title="Read-only access"
        description="Coupon changes require manager access."
      />
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link
          href="/dashboard/coupons"
          className="text-sm text-[var(--color-accent)] hover:underline"
        >
          ← Coupons
        </Link>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl tracking-tight">
          New coupon
        </h1>
      </div>
      <form
        onSubmit={onSubmit}
        className="space-y-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
      >
        <CouponFormFields form={form} setForm={setForm} />
        {error ? (
          <p className="text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}
        <Button type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Create'}
        </Button>
      </form>
    </div>
  );
}

export default function NewCouponPage() {
  return (
    <StoreScoped>
      <NewCouponContent />
    </StoreScoped>
  );
}
