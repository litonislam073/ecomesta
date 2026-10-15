'use client';

import { useEffect } from 'react';
import { apiBaseUrl } from '@/lib/public-api';
import { merchantUrl } from '@/lib/marketing/site';

export const REFERRAL_COOKIE = 'ecomesta_ref';
const CODE = /^[A-Z0-9]{3,32}$/;

/**
 * The domain both the website and the merchant app sit under (ecomesta.com for
 * www.ecomesta.com + app.ecomesta.com), so the merchant sign-up can read the
 * cookie. Null when they share none (or on localhost, where ports share cookies).
 */
export function sharedCookieDomain(siteHost: string, appHost: string): string | null {
  const a = siteHost.toLowerCase().split('.');
  const b = appHost.toLowerCase().split('.');
  const common: string[] = [];
  while (a.length && b.length && a[a.length - 1] === b[b.length - 1]) {
    common.unshift(a.pop()!);
    b.pop();
  }
  return common.length >= 2 ? common.join('.') : null;
}

export function readReferralCookie(cookie: string): string | null {
  const match = cookie.match(/(?:^|;\s*)ecomesta_ref=([^;]+)/);
  const code = match?.[1] ? decodeURIComponent(match[1]).toUpperCase() : null;
  return code && CODE.test(code) ? code : null;
}

/** Adds the remembered code to links into the merchant sign-up (covers apps on different domains). */
export function withReferral(href: string, code: string, appOrigin: string): string {
  try {
    const url = new URL(href, window.location.href);
    if (url.origin !== appOrigin || url.pathname !== '/register' || url.searchParams.has('ref')) return href;
    url.searchParams.set('ref', code);
    return url.toString();
  } catch {
    return href;
  }
}

/**
 * Remembers a referral link (`?ref=CODE`) for the program's cookie window and
 * counts the visit. Renders nothing.
 */
export function ReferralCapture() {
  useEffect(() => {
    let appOrigin = '';
    try {
      appOrigin = new URL(merchantUrl(), window.location.href).origin;
    } catch {
      /* no merchant app configured */
    }

    const param = new URLSearchParams(window.location.search).get('ref')?.trim().toUpperCase();
    if (param && CODE.test(param)) {
      void fetch(`${apiBaseUrl()}/public/affiliate/click`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: param }),
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((body: { data?: { valid?: boolean; cookieDays?: number } } | null) => {
          if (!body?.data?.valid) return;
          const days = body.data.cookieDays ?? 30;
          const domain = appOrigin ? sharedCookieDomain(window.location.hostname, new URL(appOrigin).hostname) : null;
          document.cookie = [
            `${REFERRAL_COOKIE}=${encodeURIComponent(param)}`,
            'path=/',
            `max-age=${days * 86400}`,
            'SameSite=Lax',
            ...(domain ? [`domain=${domain}`] : []),
            ...(window.location.protocol === 'https:' ? ['Secure'] : []),
          ].join('; ');
        })
        .catch(() => undefined);
    }

    if (!appOrigin) return;
    const onClick = (event: MouseEvent) => {
      const code = readReferralCookie(document.cookie);
      const anchor = (event.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!code || !anchor) return;
      const next = withReferral(anchor.href, code, appOrigin);
      if (next !== anchor.href) anchor.href = next;
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  return null;
}
