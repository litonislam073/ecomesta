import type { ReactNode } from 'react';
import { MarketingShell } from '@/components/marketing/marketing-shell';

/** Bangla versions of the marketing pages, at /bn. The root layout sets `lang="bn"`. */
export default function BanglaMarketingLayout({ children }: { children: ReactNode }) {
  return <MarketingShell locale="bn">{children}</MarketingShell>;
}
