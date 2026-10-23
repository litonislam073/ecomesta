const path = require('node:path');

/**
 * Content-Security-Policy for the public site. Kept deliberately practical:
 * Next.js and the GTM/GA bootstrap snippets are inline scripts (no nonce
 * pipeline here), so 'unsafe-inline' stays for scripts, but third-party script
 * origins are limited to Google Tag Manager/Analytics and the Meta pixel, and
 * objects, base-uri and framing are locked down. Images and API calls allow
 * https: because storefront product images and the API live on other hosts.
 * Only sent in production so `next dev` (HMR, eval, http API) is unaffected.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com https://connect.facebook.net",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https:",
  'frame-src https://www.googletagmanager.com https://www.youtube-nocookie.com https://www.youtube.com',
  "media-src 'self' https:",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'self'",
].join('; ');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@ecomesta/ui'],
  output: 'standalone',
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  experimental: {
    outputFileTracingRoot: path.join(__dirname, '../../'),
  },
  /**
   * Public URLs people guess or follow from old links. Sign-up lives at /register
   * (there is no Bangla sign-up page, so /bn/signup lands there too); the themes
   * and demo URLs go to the closest real marketing page instead of a 404.
   */
  async redirects() {
    return [
      { source: '/signup', destination: '/register', statusCode: 301 },
      { source: '/bn/signup', destination: '/register', statusCode: 301 },
      { source: '/themes', destination: '/features/store-customization', permanent: false },
      { source: '/bn/themes', destination: '/bn/features/store-customization', permanent: false },
      { source: '/demo', destination: '/features', permanent: false },
      { source: '/bn/demo', destination: '/bn/features', permanent: false },
    ];
  },
  async headers() {
    return [
      ...(process.env.NODE_ENV === 'production'
        ? [
            {
              source: '/:path*',
              headers: [{ key: 'Content-Security-Policy', value: contentSecurityPolicy }],
            },
          ]
        : []),
      {
        source: '/_next/static/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        source: '/demo-catalog/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        source: '/brand/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ];
  },
};

module.exports = nextConfig;
/** Exported for unit tests only — Next ignores unknown exports on the config object. */
module.exports.contentSecurityPolicy = contentSecurityPolicy;
