import Script from 'next/script';

/** Google Tag Manager container for the Ecomesta platform website. */
export const GTM_ID = 'GTM-54C9MB8X';

/**
 * Loaded only on the platform website (it is rendered from MarketingShell,
 * which merchant storefronts never use), so shoppers on merchants' stores are
 * not tracked. Production builds only: local development does not send visits.
 */
function enabled(): boolean {
  return process.env.NODE_ENV === 'production';
}

/** The GTM loader script, as Google provides it. */
export function GoogleTagManagerScript() {
  if (!enabled()) return null;
  return (
    <Script id="google-tag-manager" strategy="afterInteractive">
      {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${GTM_ID}');`}
    </Script>
  );
}

/** GTM fallback for browsers without JavaScript; goes right after <body> opens. */
export function GoogleTagManagerNoScript() {
  if (!enabled()) return null;
  return (
    <noscript>
      <iframe
        src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
        height="0"
        width="0"
        style={{ display: 'none', visibility: 'hidden' }}
      />
    </noscript>
  );
}
