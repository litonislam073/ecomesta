export const SITE_NAME = 'Ecomesta';

export const SITE_DESCRIPTION =
  'Ecomesta helps Bangladesh businesses create and manage online stores — products, inventory, orders, payments, shipping and customers from one platform.';

function trimSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

function platformRootDomain(): string | null {
  const root = process.env.NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN?.trim().toLowerCase();
  return root ? root.replace(/^\.+|\.+$/g, '') : null;
}

/** Public origin of the marketing site (no trailing slash). */
export function siteUrl(): string {
  const configured =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() || process.env.NEXT_PUBLIC_WEB_URL?.trim();
  if (configured) {
    return trimSlash(configured);
  }
  const root = platformRootDomain();
  if (isProduction() && root) {
    return `https://${root}`;
  }
  return 'http://localhost:3000';
}

/** Origin of the merchant application (register, login, dashboard). */
export function merchantUrl(path = ''): string {
  const configured = process.env.NEXT_PUBLIC_MERCHANT_URL?.trim();
  let origin: string;
  if (configured) {
    origin = trimSlash(configured);
  } else {
    const root = platformRootDomain();
    // Never ship localhost links from a production build.
    origin =
      isProduction() && root ? `https://merchant.${root}` : 'http://localhost:3002';
  }
  if (!path) {
    return origin;
  }
  return `${origin}${path.startsWith('/') ? path : `/${path}`}`;
}

export function absoluteUrl(path = '/'): string {
  return `${siteUrl()}${path.startsWith('/') ? path : `/${path}`}`;
}

export const registerUrl = () => merchantUrl('/register');
export const loginUrl = () => merchantUrl('/login');

export function contactEmail(): string | null {
  const email = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim();
  return email || null;
}

export function googleSiteVerification(): string | undefined {
  return process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION?.trim() || undefined;
}

export const DEFAULT_OG_IMAGE_PATH = '/og/default';
