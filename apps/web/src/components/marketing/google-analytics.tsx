import Script from 'next/script';

/** Google Analytics 4 property for the Ecomesta platform website. */
export const GA4_MEASUREMENT_ID = 'G-3F3EJKLDYK';

/**
 * The Google tag (gtag.js), as Google provides it. Like the GTM container it is
 * rendered from MarketingShell only, so merchant storefronts never load it, and
 * only in production builds so local development sends no visits.
 * Keep GA4 out of the GTM container while this is here, or page views count twice.
 */
export function GoogleAnalyticsScript() {
  if (process.env.NODE_ENV !== 'production') return null;
  return (
    <>
      <Script
        id="google-analytics-loader"
        src={`https://www.googletagmanager.com/gtag/js?id=${GA4_MEASUREMENT_ID}`}
        strategy="lazyOnload"
      />
      <Script id="google-analytics" strategy="lazyOnload">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA4_MEASUREMENT_ID}');`}
      </Script>
    </>
  );
}
