import {
  captureAttributionFromVisit,
  type SignupAttributionInput,
} from '@ecomesta/utils';
import { readReferralCode } from '@/lib/referral';

export const ATTRIBUTION_COOKIE = 'ecomesta_src';
const DAY_SECONDS = 24 * 60 * 60;
const COOKIE_DAYS = 30;

type StoredAttribution = {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  referrerHost?: string;
  landingPath?: string;
};

function parseStored(raw: string | null | undefined): StoredAttribution | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredAttribution;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

function readCookieValue(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)ecomesta_src=([^;]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

function writeCookie(value: StoredAttribution, domain?: string | null): void {
  if (typeof document === 'undefined') return;
  document.cookie = [
    `${ATTRIBUTION_COOKIE}=${encodeURIComponent(JSON.stringify(value))}`,
    'path=/',
    `max-age=${COOKIE_DAYS * DAY_SECONDS}`,
    'SameSite=Lax',
    ...(domain ? [`domain=${domain}`] : []),
    ...(window.location.protocol === 'https:' ? ['Secure'] : []),
  ].join('; ');
}

function hasAny(value: StoredAttribution | null): boolean {
  if (!value) return false;
  return Boolean(
    value.utmSource ||
      value.utmMedium ||
      value.utmCampaign ||
      value.referrerHost ||
      value.landingPath,
  );
}

/**
 * First-touch: remember UTM / referrer / path once. Does not overwrite an
 * existing attribution cookie.
 */
export function rememberSignupAttribution(options?: {
  search?: string;
  referrer?: string | null;
  pathname?: string | null;
  domain?: string | null;
}): void {
  if (typeof window === 'undefined') return;
  if (hasAny(parseStored(readCookieValue()))) return;

  const captured = captureAttributionFromVisit({
    search: options?.search ?? window.location.search,
    referrer: options?.referrer ?? document.referrer,
    pathname: options?.pathname ?? window.location.pathname,
  });
  const stored: StoredAttribution = {
    utmSource: captured.utmSource ?? undefined,
    utmMedium: captured.utmMedium ?? undefined,
    utmCampaign: captured.utmCampaign ?? undefined,
    referrerHost: captured.referrerHost ?? undefined,
    landingPath: captured.landingPath ?? undefined,
  };
  if (!hasAny(stored)) return;
  writeCookie(stored, options?.domain);
}

/** Payload for `/auth/register` and `/auth/google` (includes affiliate ref). */
export function readSignupAttributionForApi(): SignupAttributionInput & {
  referralCode?: string;
} {
  const stored = parseStored(readCookieValue()) ?? {};
  const referralCode = readReferralCode() ?? undefined;
  return {
    utmSource: stored.utmSource,
    utmMedium: stored.utmMedium,
    utmCampaign: stored.utmCampaign,
    referrerHost: stored.referrerHost,
    landingPath: stored.landingPath,
    referralCode,
  };
}
