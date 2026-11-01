/**
 * First-touch signup attribution shared by the marketing site, merchant app and API.
 * Pure helpers only — no document/cookie access here.
 */

export const SIGNUP_CHANNELS = [
  'facebook',
  'google',
  'instagram',
  'youtube',
  'affiliate',
  'direct',
  'referral',
  'other',
] as const;

export type SignupChannel = (typeof SIGNUP_CHANNELS)[number];

export const SIGNUP_CHANNEL_LABELS: Record<SignupChannel, string> = {
  facebook: 'Facebook',
  google: 'Google',
  instagram: 'Instagram',
  youtube: 'YouTube',
  affiliate: 'Affiliate',
  direct: 'Direct',
  referral: 'Referral',
  other: 'Other',
};

export interface SignupAttributionInput {
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  referrerHost?: string | null;
  landingPath?: string | null;
  affiliateCode?: string | null;
}

export interface NormalizedSignupAttribution {
  channel: SignupChannel;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  referrerHost: string | null;
  landingPath: string | null;
  affiliateCode: string | null;
}

const AFFILIATE_CODE = /^[A-Z0-9]{3,32}$/;

function clip(value: string | null | undefined, max: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

function lowerClip(value: string | null | undefined, max: number): string | null {
  const clipped = clip(value, max);
  return clipped ? clipped.toLowerCase() : null;
}

/** Host only from a full referrer URL; null when missing or unparseable. */
export function referrerHostFromUrl(referrer: string | null | undefined): string | null {
  const raw = clip(referrer, 2000);
  if (!raw) return null;
  try {
    const host = new URL(raw).hostname.toLowerCase().replace(/^www\./, '');
    return host ? host.slice(0, 255) : null;
  } catch {
    return null;
  }
}

/** Path without query/hash, capped for storage. */
export function landingPathFromPathname(pathname: string | null | undefined): string | null {
  const raw = clip(pathname, 255);
  if (!raw) return null;
  const path = raw.startsWith('/') ? raw : `/${raw}`;
  return path.slice(0, 255);
}

export function normalizeAffiliateCode(value: string | null | undefined): string | null {
  const code = clip(value, 32)?.toUpperCase() ?? null;
  return code && AFFILIATE_CODE.test(code) ? code : null;
}

function matchesKnown(source: string | null, host: string | null, needles: string[]): boolean {
  const hay = `${source ?? ''} ${host ?? ''}`.toLowerCase();
  return needles.some((n) => hay.includes(n));
}

/**
 * Channel priority: affiliate → known paid/social → other referrer → direct.
 */
export function deriveSignupChannel(input: SignupAttributionInput): SignupChannel {
  if (normalizeAffiliateCode(input.affiliateCode)) return 'affiliate';

  const utm = lowerClip(input.utmSource, 100);
  const host = lowerClip(input.referrerHost, 255);

  if (matchesKnown(utm, host, ['facebook', 'fb.', 'fbclid', 'meta'])) return 'facebook';
  if (matchesKnown(utm, host, ['instagram', 'ig.'])) return 'instagram';
  if (matchesKnown(utm, host, ['youtube', 'youtu.be'])) return 'youtube';
  if (matchesKnown(utm, host, ['google', 'googleads', 'gclid', 'bing', 'yahoo', 'duckduckgo'])) {
    return 'google';
  }

  if (utm) return 'other';
  if (host) return 'referral';
  return 'direct';
}

/** Sanitize client-supplied attribution and derive the channel for storage. */
export function normalizeSignupAttribution(
  input: SignupAttributionInput,
): NormalizedSignupAttribution {
  const utmSource = lowerClip(input.utmSource, 100);
  const utmMedium = lowerClip(input.utmMedium, 100);
  const utmCampaign = clip(input.utmCampaign, 150);
  const referrerHost = lowerClip(input.referrerHost, 255)?.replace(/^www\./, '') ?? null;
  const landingPath = landingPathFromPathname(input.landingPath);
  const affiliateCode = normalizeAffiliateCode(input.affiliateCode);

  return {
    channel: deriveSignupChannel({
      utmSource,
      utmMedium,
      utmCampaign,
      referrerHost,
      landingPath,
      affiliateCode,
    }),
    utmSource,
    utmMedium,
    utmCampaign,
    referrerHost,
    landingPath,
    affiliateCode,
  };
}

/** Read UTM + referrer + path from a page visit (no affiliate — that stays on `ref`). */
export function captureAttributionFromVisit(input: {
  search: string | URLSearchParams;
  referrer: string | null | undefined;
  pathname: string | null | undefined;
}): SignupAttributionInput {
  const params =
    typeof input.search === 'string' ? new URLSearchParams(input.search) : input.search;
  return {
    utmSource: params.get('utm_source'),
    utmMedium: params.get('utm_medium'),
    utmCampaign: params.get('utm_campaign'),
    referrerHost: referrerHostFromUrl(input.referrer),
    landingPath: landingPathFromPathname(input.pathname),
  };
}

export function formatSignupChannelLabel(channel: string | null | undefined): string {
  if (!channel) return 'Unknown';
  if ((SIGNUP_CHANNELS as readonly string[]).includes(channel)) {
    return SIGNUP_CHANNEL_LABELS[channel as SignupChannel];
  }
  return channel;
}

/** Short subtitle under the channel in admin lists. */
export function signupAttributionSubtitle(attrs: {
  signupAffiliateCode?: string | null;
  signupUtmSource?: string | null;
  signupUtmCampaign?: string | null;
  signupReferrerHost?: string | null;
}): string | null {
  if (attrs.signupAffiliateCode) return `ref ${attrs.signupAffiliateCode}`;
  if (attrs.signupUtmCampaign) {
    return attrs.signupUtmSource
      ? `${attrs.signupUtmSource} · ${attrs.signupUtmCampaign}`
      : attrs.signupUtmCampaign;
  }
  if (attrs.signupUtmSource) return attrs.signupUtmSource;
  if (attrs.signupReferrerHost) return attrs.signupReferrerHost;
  return null;
}
