const COOKIE = 'ecomesta_ref';
const CODE = /^[A-Z0-9]{3,32}$/;
const DAY_SECONDS = 24 * 60 * 60;

function clean(value: string | null | undefined): string | null {
  const code = value?.trim().toUpperCase();
  return code && CODE.test(code) ? code : null;
}

/** The affiliate code this browser came through: the website's cookie or a `?ref=` on the sign-up link. */
export function readReferralCode(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)ecomesta_ref=([^;]+)/);
  return clean(match?.[1] ? decodeURIComponent(match[1]) : null);
}

/** Keeps a `?ref=` from the sign-up link until the account is created (30 days, like the website). */
export function rememberReferralCode(value: string | null | undefined): void {
  const code = clean(value);
  if (!code || typeof document === 'undefined') return;
  document.cookie = `${COOKIE}=${encodeURIComponent(code)}; path=/; max-age=${30 * DAY_SECONDS}; SameSite=Lax${
    window.location.protocol === 'https:' ? '; Secure' : ''
  }`;
}

export const AFFILIATE_PATH = '/dashboard/affiliate';

/** Sign-up or sign-in that came from "Join the affiliate program" (`?for=affiliate`). */
export function isAffiliateIntent(params: { get(name: string): string | null }): boolean {
  return params.get('for') === 'affiliate' || params.get('next') === AFFILIATE_PATH;
}
