import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { NOINDEX } from '@/lib/store-seo';

export const metadata: Metadata = { title: 'Cart', robots: NOINDEX };

export default function CartLayout({ children }: { children: ReactNode }) {
  return children;
}
