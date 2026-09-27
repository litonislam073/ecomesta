const DEFAULT_WEB_URL = 'http://localhost:3000';

const DNS_LABEL = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

function isLoopbackHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host === '127.0.0.1' ||
    host === '[::1]'
  );
}

/**
 * Public URL of a store. Deployed environments serve stores on
 * `{slug}.{PLATFORM_ROOT_DOMAIN}` and ignore `?store=` (it only selects a store
 * on loopback hosts), so the query form is kept for local development only.
 */
export function storefrontUrl(storeSlug: string): string {
  const base = (process.env.NEXT_PUBLIC_WEB_URL || DEFAULT_WEB_URL).replace(/\/+$/, '');
  const rootDomain = process.env.NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN?.trim().toLowerCase();

  let webUrl: URL | null = null;
  try {
    webUrl = new URL(base);
  } catch {
    webUrl = null;
  }

  if (rootDomain && webUrl && !isLoopbackHost(webUrl.hostname) && DNS_LABEL.test(storeSlug)) {
    const port = webUrl.port ? `:${webUrl.port}` : '';
    return `${webUrl.protocol}//${storeSlug}.${rootDomain}${port}/`;
  }
  return `${base}/?store=${encodeURIComponent(storeSlug)}`;
}

/**
 * Address a new store will actually be reachable at, or null when it cannot be
 * known: deployed builds without a platform root domain would otherwise show a
 * `?store=` URL that deployed hosts ignore.
 */
export function storefrontPreviewUrl(storeSlug: string): string | null {
  const base = (process.env.NEXT_PUBLIC_WEB_URL || DEFAULT_WEB_URL).replace(/\/+$/, '');
  const rootDomain = process.env.NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN?.trim().toLowerCase();
  let hostname: string;
  try {
    hostname = new URL(base).hostname;
  } catch {
    return null;
  }
  if (!DNS_LABEL.test(storeSlug)) {
    return null;
  }
  if (!isLoopbackHost(hostname) && !rootDomain) {
    return null;
  }
  return storefrontUrl(storeSlug).replace(/\/$/, '');
}
