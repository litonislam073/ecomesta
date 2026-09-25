import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const COOKIE_KEY = 'ecomesta.storeSlug';

export function middleware(request: NextRequest) {
  const store = request.nextUrl.searchParams.get('store')?.trim().toLowerCase();
  if (!store) {
    return NextResponse.next();
  }
  const response = NextResponse.next();
  response.cookies.set(COOKIE_KEY, store, {
    path: '/',
    sameSite: 'lax',
    httpOnly: false,
  });
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
