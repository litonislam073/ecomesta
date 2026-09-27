import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { NOINDEX } from '@/lib/store-seo';

export const metadata: Metadata = { title: 'Payment', robots: NOINDEX };

export default function PaymentLayout({ children }: { children: ReactNode }) {
  return children;
}
