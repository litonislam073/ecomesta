/**
 * Phase 17 custom domains — hostname normalisation and platform reservations.
 *
 * Kept free of NestJS imports so the resolver, the merchant service and unit
 * tests can share one definition of "what a hostname is".
 */

export const DEFAULT_PLATFORM_ROOT_DOMAIN = 'ecomesta.local';

/** Label prefixed to the hostname for the DNS TXT ownership challenge. */
export const DOMAIN_VERIFICATION_PREFIX = '_ecomesta-verification';

/** Fixed platform hosts, independent of PLATFORM_ROOT_DOMAIN. */
const PLATFORM_APEX = 'ecomesta.com';

/** Sub-labels the platform keeps for itself under any root domain. */
const RESERVED_SUBDOMAINS = ['www', 'api', 'admin', 'merchant'] as const;

const LOCAL_HOSTS = ['localhost', '127.0.0.1', '::1'] as const;

const LABEL_PATTERN = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
const IPV4_PATTERN = /^\d{1,3}(\.\d{1,3}){3}$/;

export interface HostnameValidationResult {
  hostname?: string;
  error?: string;
}

export interface NormalizeOptions {
  /** Allows `localhost` / loopback hostnames (development and test only). */
  allowLocal?: boolean;
}

export class InvalidHostnameError extends Error {}

/**
 * Accepts what merchants actually paste — `https://Shop.Example.com/checkout?x=1`
 * — and returns the bare registrable hostname, or throws for anything that is
 * not routable as a storefront host.
 */
export function normalizeHostname(
  input: string,
  options: NormalizeOptions = {},
): string {
  const result = validateHostname(input, options);
  if (!result.hostname) {
    throw new InvalidHostnameError(result.error ?? 'Invalid hostname');
  }
  return result.hostname;
}

/** Non-throwing variant; callers map `error` onto their own exception type. */
export function validateHostname(
  input: string,
  options: NormalizeOptions = {},
): HostnameValidationResult {
  if (typeof input !== 'string') {
    return { error: 'Hostname must be a string' };
  }

  let host = input.trim().toLowerCase();
  if (!host) {
    return { error: 'Hostname is required' };
  }

  host = host.replace(/^[a-z][a-z0-9+.-]*:\/\//, '');
  host = host.split(/[/?#]/, 1)[0] ?? '';
  host = host.replace(/\.+$/, '');

  if (!host) {
    return { error: 'Hostname is required' };
  }
  if (host.includes('@')) {
    return { error: 'Hostname must not contain credentials' };
  }
  if (host.includes('*')) {
    return { error: 'Wildcard hostnames are not supported' };
  }
  if (/\s/.test(host)) {
    return { error: 'Hostname must not contain spaces' };
  }
  if (host.startsWith('[') || host.split(':').length > 2) {
    return { error: 'IP address hostnames are not supported' };
  }

  const [hostWithoutPort = '', port] = host.split(':');
  if (port !== undefined && !/^\d{1,5}$/.test(port)) {
    return { error: 'Malformed hostname' };
  }
  host = hostWithoutPort;

  if (!host) {
    return { error: 'Hostname is required' };
  }
  if (host.length > 253) {
    return { error: 'Hostname must be 253 characters or fewer' };
  }
  if (!/^[a-z0-9.-]+$/.test(host)) {
    return {
      error: 'Hostname may only contain letters, digits, dots and hyphens',
    };
  }

  const isLoopback = (LOCAL_HOSTS as readonly string[]).includes(host);
  if (IPV4_PATTERN.test(host) || host === 'localhost') {
    if (!(options.allowLocal && isLoopback)) {
      return { error: 'IP address hostnames are not supported' };
    }
    return { hostname: host };
  }

  const labels = host.split('.');
  if (labels.length < 2) {
    return { error: 'Hostname must include a top-level domain' };
  }
  for (const label of labels) {
    if (!LABEL_PATTERN.test(label)) {
      return { error: `Invalid hostname label: "${label}"` };
    }
  }
  const tld = labels[labels.length - 1]!;
  if (!/^[a-z]{2,63}$/.test(tld)) {
    return { error: 'Hostname must end with a valid top-level domain' };
  }

  return { hostname: host };
}

/**
 * Store slugs that would map onto a platform control host (`api.{root}`, …)
 * and therefore could never be served as a storefront.
 */
export function isReservedStoreSlug(slug: string): boolean {
  return (RESERVED_SUBDOMAINS as readonly string[]).includes(
    slug.trim().toLowerCase(),
  );
}

/** `{slug}.{root}` — the always-available storefront host for a store. */
export function platformSubdomainHostname(
  storeSlug: string,
  platformRoot: string,
): string {
  return `${storeSlug.trim().toLowerCase()}.${platformRoot.trim().toLowerCase()}`;
}

/**
 * Platform-owned hosts that can never belong to a store: the apex domains and
 * their control-plane sub-labels. Used by the public resolver, which must still
 * resolve ordinary `{slug}.{root}` storefronts.
 */
export function isPlatformControlHostname(
  hostname: string,
  platformRoot: string,
): boolean {
  const host = hostname.trim().toLowerCase();
  const root = platformRoot.trim().toLowerCase();
  if ((LOCAL_HOSTS as readonly string[]).includes(host)) {
    return true;
  }
  for (const apex of new Set([PLATFORM_APEX, root])) {
    if (host === apex) {
      return true;
    }
    if (RESERVED_SUBDOMAINS.some((label) => host === `${label}.${apex}`)) {
      return true;
    }
  }
  return false;
}

/**
 * Hosts a merchant may not register as a custom domain. Stricter than
 * `isPlatformControlHostname`: the whole platform root namespace is off limits
 * because those subdomains are provisioned from store slugs.
 */
export function isReservedHostname(
  hostname: string,
  platformRoot: string,
): boolean {
  const host = hostname.trim().toLowerCase();
  const root = platformRoot.trim().toLowerCase();
  if (isPlatformControlHostname(host, root)) {
    return true;
  }
  for (const apex of new Set([PLATFORM_APEX, root])) {
    if (host === apex || host.endsWith(`.${apex}`)) {
      return true;
    }
  }
  return false;
}

/** Extracts `{slug}` from `{slug}.{root}`; null when the host is elsewhere. */
export function platformSubdomainSlug(
  hostname: string,
  platformRoot: string,
): string | null {
  const host = hostname.trim().toLowerCase();
  const suffix = `.${platformRoot.trim().toLowerCase()}`;
  if (!host.endsWith(suffix)) {
    return null;
  }
  const slug = host.slice(0, -suffix.length);
  // Only single-label subdomains map to a store slug.
  if (!slug || slug.includes('.')) {
    return null;
  }
  return slug;
}

export function verificationRecordName(hostname: string): string {
  return `${DOMAIN_VERIFICATION_PREFIX}.${hostname}`;
}
