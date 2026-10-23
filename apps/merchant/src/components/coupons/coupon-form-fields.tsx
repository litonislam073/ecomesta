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

/** Merchant-facing name for a coupon discount type (never the raw enum). */
export function couponTypeLabel(type: string): string {
  if (type === 'PERCENTAGE') return 'Percentage';
  if (type === 'FIXED_AMOUNT') return 'Fixed amount';
  return type;
}

export type CouponFormErrors = Partial<Record<'code' | 'value', string>>;

/** Explicit required-field checks, run on submit (the form opts out of silent browser validation). */
export function validateCouponForm(form: CouponFormState): CouponFormErrors {
  const errors: CouponFormErrors = {};
  if (!form.code.trim()) errors.code = 'Coupon code is required.';
  const value = form.value.trim();
  if (!value) {
    errors.value = 'Discount value is required.';
  } else if (!Number.isFinite(Number(value)) || Number(value) <= 0) {
    errors.value = 'Enter a discount value greater than 0.';
  } else if (form.type === 'PERCENTAGE' && Number(value) > 100) {
    errors.value = 'A percentage discount cannot be more than 100.';
  }
  return errors;
}

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <span id={id} className="block text-xs text-red-700">
      {message}
    </span>
  ) : null;
}

export function CouponFormFields({
  form,
  setForm,
  errors = {},
}: {
  form: CouponFormState;
  setForm: Dispatch<SetStateAction<CouponFormState>>;
  errors?: CouponFormErrors;
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
          aria-invalid={errors.code ? true : undefined}
          aria-describedby={errors.code ? 'coupon-code-error' : undefined}
        />
        <FieldError id="coupon-code-error" message={errors.code} />
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
            <option value="PERCENTAGE">{couponTypeLabel('PERCENTAGE')}</option>
            <option value="FIXED_AMOUNT">{couponTypeLabel('FIXED_AMOUNT')}</option>
          </Select>
        </label>
        <label className="block space-y-1 text-sm">
          <span>Value</span>
          <Input
            value={form.value}
            onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
            required
            aria-label="Coupon value"
            aria-invalid={errors.value ? true : undefined}
            aria-describedby={errors.value ? 'coupon-value-error' : undefined}
          />
          <FieldError id="coupon-value-error" message={errors.value} />
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
