'use client';

import { useEffect, useRef, useState } from 'react';
import type { ManualPaymentAccount, ThemeListItem, ThemePurchase } from '@ecomesta/types';
import { ManualPaymentPanel } from '@/components/billing/manual-payment';
import { PaymentDialog } from '@/components/billing/payment-dialog';
import { api } from '@/lib/api-client';
import { humanApiError } from '@/lib/catalog-utils';

/**
 * Buys a premium theme by mobile wallet. The payment is reviewed by the
 * Ecomesta team; the theme unlocks for every store of the business once
 * it is approved.
 */
export function ThemePurchaseDialog({
  storeId,
  theme,
  onClose,
  onSubmitted,
}: {
  storeId: string;
  theme: ThemeListItem;
  onClose: () => void;
  onSubmitted: (purchase: ThemePurchase) => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [accounts, setAccounts] = useState<ManualPaymentAccount[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get<{ success: true; data: ManualPaymentAccount[] }>('/billing/payment-accounts')
      .then((result) => {
        if (!cancelled) setAccounts(result.data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(humanApiError(err, 'Could not load the payment numbers'));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const amount = Number(theme.priceBdt ?? 0);

  return (
    <PaymentDialog
      active
      title={`Buy the ${theme.name} theme`}
      subtitle="One-time payment. It unlocks on all your stores as soon as our team confirms it."
      headingRef={headingRef}
      onClose={onClose}
    >
      {error ? (
        <p role="alert" className="rounded-lg border border-[#f1c9b8] bg-[#fdf3ee] px-3 py-2 text-sm text-[#a3441f]">
          {error}
        </p>
      ) : accounts === null ? (
        <p className="py-6 text-center text-sm text-[var(--color-muted)]">Loading payment options…</p>
      ) : accounts.length === 0 ? (
        <p className="rounded-lg bg-[#f6faf8] px-3 py-2 text-sm text-[var(--color-ink)]">
          Wallet payments are not available right now. Please contact Ecomesta support.
        </p>
      ) : (
        <ManualPaymentPanel
          variant="compact"
          accounts={accounts}
          token={null}
          trialEndsAt={null}
          item={{ name: `${theme.name} theme`, detail: 'Premium theme · one-time, no renewal', amount }}
          note="Our team checks every payment. The theme unlocks here once it is confirmed."
          submitLabel={(price, wallet) => `Pay ${price} with ${wallet}`}
          onPay={async (payment) => {
            try {
              const result = await api.post<{ success: true; data: ThemePurchase }>(
                `/stores/${storeId}/themes/${theme.id}/purchase`,
                payment,
              );
              onSubmitted(result.data);
            } catch (err) {
              throw new Error(humanApiError(err, 'Could not submit your payment. Please try again.'));
            }
          }}
        />
      )}
    </PaymentDialog>
  );
}
