'use client';

import { useEffect } from 'react';
import { captureAttributionFromVisit } from '@ecomesta/utils';
import { merchantUrl } from '@/lib/marketing/site';
import { sharedCookieDomain } from '@/components/marketing/referral-capture';

export const ATTRIBUTION_COOKIE = 'ecomesta_src';
const COOKIE_DAYS = 30;

type Stored = {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  referrerHost?: string;
  landingPath?: string;
};

function readExisting(): Stored | null {
  const match = document.cookie.match(/(?:^|;\s*)ecomesta_src=([^;]+)/);
  if (!match?.[1]) return null;
  try {
    return JSON.parse(decodeURIComponent(match[1])) as Stored;
  } catch {
    return null;
  }
}

function hasAny(value: Stored | null): boolean {
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
 * First-touch signup attribution on the marketing site. Shares the cookie with
 * merchant.* when both sit under ecomesta.com (same pattern as affiliate ref).
 */
export function AttributionCapture() {
  useEffect(() => {
    if (hasAny(readExisting())) return;

    const captured = captureAttributionFromVisit({
      search: window.location.search,
      referrer: document.referrer,
      pathname: window.location.pathname,
    });
    const stored: Stored = {
      utmSource: captured.utmSource ?? undefined,
      utmMedium: captured.utmMedium ?? undefined,
      utmCampaign: captured.utmCampaign ?? undefined,
      referrerHost: captured.referrerHost ?? undefined,
      landingPath: captured.landingPath ?? undefined,
    };
    if (!hasAny(stored)) return;

    let domain: string | null = null;
    try {
      domain = sharedCookieDomain(window.location.hostname, new URL(merchantUrl()).hostname);
    } catch {
      domain = null;
    }

    document.cookie = [
      `${ATTRIBUTION_COOKIE}=${encodeURIComponent(JSON.stringify(stored))}`,
      'path=/',
      `max-age=${COOKIE_DAYS * 86400}`,
      'SameSite=Lax',
      ...(domain ? [`domain=${domain}`] : []),
      ...(window.location.protocol === 'https:' ? ['Secure'] : []),
    ].join('; ');
  }, []);

  return null;
}
