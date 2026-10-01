import type { ReactNode } from 'react';
import { MarketingShell as SharedMarketingShell } from '@ecomesta/ui/marketing';
import { AiSupportLauncher } from '@/components/ai-support/ai-support-launcher';
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
      {/* Platform website only: storefronts never render MarketingShell. */}
      <AiSupportLauncher />
    </SharedMarketingShell>
  );
}
