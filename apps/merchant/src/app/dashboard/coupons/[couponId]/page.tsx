'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import type { Coupon, CouponType } from '@ecomesta/types';
import { Button } from '@ecomesta/ui';
import {
  CouponFormFields,
  emptyCouponForm,
  type CouponFormState,
} from '@/components/coupons/coupon-form-fields';
import { StoreScoped } from '@/components/catalog/store-scoped';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { useToast } from '@/components/ui/toast';
import { ApiError, api } from '@/lib/api-client';
import { humanApiError } from '@/lib/catalog-utils';
import { useCanManageStore } from '@/lib/permissions';
import { useStoreContext } from '@/lib/store-context';

function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function EditCouponContent() {
  const params = useParams<{ couponId: string }>();
  const couponId = params.couponId;
  const { selectedStoreId } = useStoreContext();
  const canWrite = useCanManageStore();
  const { pushToast } = useToast();
  const [form, setForm] = useState<CouponFormState>(emptyCouponForm());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!selectedStoreId || !couponId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.get<{ success: true; data: Coupon }>(
        `/stores/${selectedStoreId}/coupons/${couponId}`,
      );
      const c = result.data;
      setForm({
        code: c.code,
        type: c.type === 'FIXED_AMOUNT' ? 'FIXED_AMOUNT' : 'PERCENTAGE',
        value: c.value,
        active: c.active,
        startsAt: toLocalInput(c.startsAt),
        expiresAt: toLocalInput(c.expiresAt),
        usageLimit: c.usageLimit != null ? String(c.usageLimit) : '',
        perCustomerLimit:
          c.perCustomerLimit != null ? String(c.perCustomerLimit) : '',
        minimumOrderAmount: c.minimumOrderAmount ?? '',
        maximumDiscountAmount: c.maximumDiscountAmount ?? '',
      });
    } catch (err) {
      setError(humanApiError(err, 'Failed to load coupon'));
    } finally {
      setLoading(false);
    }
  }, [selectedStoreId, couponId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!selectedStoreId || !couponId || !canWrite) return;
    setBusy(true);
    setError(null);
    try {
      await api.patch(`/stores/${selectedStoreId}/coupons/${couponId}`, {
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
      });
      pushToast('Coupon updated', 'success');
      await load();
    } catch (err) {
      setError(humanApiError(err, 'Could not save coupon'));
      if (err instanceof ApiError) pushToast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function deactivate() {
    if (!selectedStoreId || !couponId || !canWrite) return;
    setBusy(true);
    try {
      await api.patch(`/stores/${selectedStoreId}/coupons/${couponId}`, {
        active: false,
      });
      pushToast('Coupon deactivated', 'success');
      await load();
    } catch (err) {
      pushToast(humanApiError(err, 'Could not deactivate'), 'error');
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
          Edit coupon
        </h1>
      </div>

      {loading ? <LoadingState label="Loading coupon" /> : null}
      {!loading && error && !form.code ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : null}

      {!loading && form.code ? (
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
          <div className="flex flex-wrap gap-2">
            {canWrite ? (
              <>
                <Button type="submit" disabled={busy}>
                  {busy ? 'Saving…' : 'Save'}
                </Button>
                {form.active ? (
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => void deactivate()}
                  >
                    Deactivate
                  </Button>
                ) : null}
              </>
            ) : (
              <EmptyState
                title="Read-only access"
                description="Coupon changes require manager access."
              />
            )}
          </div>
        </form>
      ) : null}
    </div>
  );
}

export default function EditCouponPage() {
  return (
    <StoreScoped>
      <EditCouponContent />
    </StoreScoped>
  );
}
