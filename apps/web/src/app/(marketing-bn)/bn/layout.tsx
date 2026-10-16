import type { ReactNode } from 'react';
import { HtmlLang } from '@/components/marketing/html-lang';
import { MarketingShell } from '@/components/marketing/marketing-shell';

/** Bangla versions of the marketing pages, at /bn. */
export default function BanglaMarketingLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <HtmlLang lang="bn" />
      <MarketingShell locale="bn">{children}</MarketingShell>
    </>
  );
}
