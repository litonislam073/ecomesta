import type { ReactNode } from 'react';
import { MarketingShell as SharedMarketingShell } from '@ecomesta/ui/marketing';
import { contactEmail, loginUrl, registerUrl } from '@/lib/marketing/site';

export function MarketingShell({ children }: { children: ReactNode }) {
  return (
    <SharedMarketingShell
      siteOrigin=""
      loginHref={loginUrl()}
      registerHref={registerUrl()}
      contactEmail={contactEmail()}
    >
      {children}
    </SharedMarketingShell>
  );
}
