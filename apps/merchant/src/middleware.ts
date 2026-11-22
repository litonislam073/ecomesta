import { NextResponse, type NextRequest } from 'next/server';

/** Keep in sync with apps/api `REFRESH_COOKIE_NAMES.merchant` / legacy name. */
const MERCHANT_REFRESH_COOKIE = 'ecomesta_refresh_token_merchant';
const LEGACY_REFRESH_COOKIE = 'ecomesta_refresh_token';

/**
 * `/` used `redirect()` from a Server Component, which Next can answer as a
 * 307 without a Location header (especially when the response is cached).
 * Middleware always emits a real HTTP redirect browsers and crawlers can follow.
 */
export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname !== '/') {
    return NextResponse.next();
  }

  const hasSession = Boolean(
    request.cookies.get(MERCHANT_REFRESH_COOKIE)?.value ||
      request.cookies.get(LEGACY_REFRESH_COOKIE)?.value,
  );
  const destination = hasSession ? '/dashboard' : '/login';
  return NextResponse.redirect(new URL(destination, request.url));
}

export const config = {
  matcher: ['/'],
};
