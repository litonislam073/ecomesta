import type { ReactNode } from 'react';
import { PageTransition } from '@/components/animations/decorative';

export default function MarketingTemplate({ children }: { children: ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
