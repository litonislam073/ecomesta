import type { ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { MarketingShell as SharedMarketingShell, type MarketingLocale } from '@ecomesta/ui/marketing';
import { GoogleAnalyticsScript } from '@/components/marketing/google-analytics';
import { GoogleTagManagerNoScript, GoogleTagManagerScript } from '@/components/marketing/google-tag-manager';
import { contactEmail, loginUrl, registerUrl } from '@/lib/marketing/site';

const AiSupportLauncher = dynamic(
  () =>
    import('@/components/ai-support/ai-support-launcher').then((m) => m.AiSupportLauncher),
  { ssr: false },
);
const ReferralCapture = dynamic(
  () => import('@/components/marketing/referral-capture').then((m) => m.ReferralCapture),
  { ssr: false },
);

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
        {/* Platform website only: storefronts never render MarketingShell. Deferred for LCP. */}
        <AiSupportLauncher />
        <ReferralCapture />
      </SharedMarketingShell>
    </>
  );
}
