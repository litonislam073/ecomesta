'use client';

import type { Dispatch, SetStateAction } from 'react';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

export type CouponFormState = {
  code: string;
  type: 'PERCENTAGE' | 'FIXED_AMOUNT';
  value: string;
  active: boolean;
  startsAt: string;
  expiresAt: string;
  usageLimit: string;
  perCustomerLimit: string;
  minimumOrderAmount: string;
  maximumDiscountAmount: string;
};

export function emptyCouponForm(): CouponFormState {
  return {
    code: '',
    type: 'PERCENTAGE',
    value: '10',
    active: true,
    startsAt: '',
    expiresAt: '',
    usageLimit: '',
    perCustomerLimit: '',
    minimumOrderAmount: '',
    maximumDiscountAmount: '',
  };
}

export function CouponFormFields({
  form,
  setForm,
}: {
  form: CouponFormState;
  setForm: Dispatch<SetStateAction<CouponFormState>>;
}) {
  return (
    <>
      <label className="block space-y-1 text-sm">
        <span>Code</span>
        <Input
          value={form.code}
          onChange={(e) =>
            setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))
          }
          required
          maxLength={64}
          aria-label="Coupon code"
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1 text-sm">
          <span>Type</span>
          <Select
            value={form.type}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                type: e.target.value as CouponFormState['type'],
              }))
            }
            aria-label="Coupon type"
          >
            <option value="PERCENTAGE">PERCENTAGE</option>
            <option value="FIXED_AMOUNT">FIXED_AMOUNT</option>
          </Select>
        </label>
        <label className="block space-y-1 text-sm">
          <span>Value</span>
          <Input
            value={form.value}
            onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
            required
            aria-label="Coupon value"
          />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.active}
          onChange={(e) =>
            setForm((f) => ({ ...f, active: e.target.checked }))
          }
        />
        Active
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1 text-sm">
          <span>Starts at</span>
          <Input
            type="datetime-local"
            value={form.startsAt}
            onChange={(e) =>
              setForm((f) => ({ ...f, startsAt: e.target.value }))
            }
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span>Expires at</span>
          <Input
            type="datetime-local"
            value={form.expiresAt}
            onChange={(e) =>
              setForm((f) => ({ ...f, expiresAt: e.target.value }))
            }
          />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1 text-sm">
          <span>Usage limit</span>
          <Input
            type="number"
            min={1}
            value={form.usageLimit}
            onChange={(e) =>
              setForm((f) => ({ ...f, usageLimit: e.target.value }))
            }
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span>Per-customer limit</span>
          <Input
            type="number"
            min={1}
            value={form.perCustomerLimit}
            onChange={(e) =>
              setForm((f) => ({ ...f, perCustomerLimit: e.target.value }))
            }
          />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1 text-sm">
          <span>Minimum subtotal</span>
          <Input
            value={form.minimumOrderAmount}
            onChange={(e) =>
              setForm((f) => ({ ...f, minimumOrderAmount: e.target.value }))
            }
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span>Maximum discount</span>
          <Input
            value={form.maximumDiscountAmount}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                maximumDiscountAmount: e.target.value,
              }))
            }
          />
        </label>
      </div>
    </>
  );
}
