import { Suspense } from 'react';
import { PaymentResultClient } from '@/components/payment-result-client';

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={<p className="p-8 text-sm">Loading…</p>}>
      <PaymentResultClient tone="success" title="Payment return" />
    </Suspense>
  );
}
