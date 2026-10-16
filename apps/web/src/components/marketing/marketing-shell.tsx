import type { ReactNode } from 'react';
import { MarketingShell as SharedMarketingShell, type MarketingLocale } from '@ecomesta/ui/marketing';
import { AiSupportLauncher } from '@/components/ai-support/ai-support-launcher';
import { GoogleAnalyticsScript } from '@/components/marketing/google-analytics';
import { GoogleTagManagerNoScript, GoogleTagManagerScript } from '@/components/marketing/google-tag-manager';
import { ReferralCapture } from '@/components/marketing/referral-capture';
import { contactEmail, loginUrl, registerUrl } from '@/lib/marketing/site';

export function MarketingShell({ children, locale = 'en' }: { children: ReactNode; locale?: MarketingLocale }) {
  return (
    <>
      {/* Google Tag Manager and GA4: platform website only, never on merchant storefronts. */}
      <GoogleTagManagerNoScript />
      <GoogleTagManagerScript />
      <GoogleAnalyticsScript />
      <SharedMarketingShell
        siteOrigin=""
        loginHref={loginUrl()}
        registerHref={registerUrl()}
        contactEmail={contactEmail()}
        locale={locale}
      >
        {children}
        {/* Platform website only: storefronts never render MarketingShell. */}
        <AiSupportLauncher />
        <ReferralCapture />
      </SharedMarketingShell>
    </>
  );
}
