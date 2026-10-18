import { Suspense } from 'react';
import { PaymentResultClient } from '@/components/payment-result-client';

export default function PaymentCancelPage() {
  return (
    <Suspense fallback={<p className="p-8 text-sm">Loading…</p>}>
      <PaymentResultClient tone="cancel" title="Payment cancelled" />
    </Suspense>
  );
}
