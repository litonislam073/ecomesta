export type TokenType = 'access' | 'refresh';

/** Which dashboard app owns the refresh cookie / JWT audience. */
export type AuthClientAudience = 'admin' | 'merchant';

export const AUTH_CLIENT_HEADER = 'x-ecomesta-client';

export const REFRESH_COOKIE_NAMES = {
  admin: 'ecomesta_refresh_token_admin',
  merchant: 'ecomesta_refresh_token_merchant',
} as const;

/** Pre-isolation cookie; still read once for migration. */
export const LEGACY_REFRESH_COOKIE_NAME = 'ecomesta_refresh_token';

/** @deprecated Prefer REFRESH_COOKIE_NAMES + resolveAuthClient */
export const REFRESH_COOKIE_NAME = LEGACY_REFRESH_COOKIE_NAME;

export interface AccessTokenPayload {
  sub: string;
  sid: string;
  typ: 'access';
  email: string;
  platformRole: string;
  aud?: AuthClientAudience;
}

export interface RefreshTokenPayload {
  sub: string;
  sid: string;
  typ: 'refresh';
  aud?: AuthClientAudience;
}

export interface TenantMembershipContext {
  tenantId: string;
  role: string;
  status: string;
}

export interface StoreMembershipContext {
  storeId: string;
  role: string;
  status: string;
}

export interface AuthenticatedUser {
  userId: string;
  email: string;
  platformRole: string;
  status: string;
  sessionId: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

export interface SafeUserProfile {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  emailVerified: boolean;
  status: string;
  platformRole: string;
  memberships: {
    tenants: TenantMembershipContext[];
    stores: StoreMembershipContext[];
  };
}

export type AppRole =
  | 'SUPER_ADMIN'
  | 'OWNER'
  | 'ADMIN'
  | 'STAFF'
  | 'STORE_MANAGER'
  | 'STORE_STAFF';

export function resolveAuthClient(req: {
  headers: Record<string, string | string[] | undefined>;
}): AuthClientAudience {
  const raw = req.headers[AUTH_CLIENT_HEADER] ?? req.headers['X-Ecomesta-Client'];
  const value = (Array.isArray(raw) ? raw[0] : raw)?.trim().toLowerCase();
  if (value === 'admin') return 'admin';
  return 'merchant';
}

export function refreshCookieNameFor(client: AuthClientAudience): string {
  return REFRESH_COOKIE_NAMES[client];
}

export function readRefreshCookie(
  cookies: Record<string, unknown> | undefined,
  client: AuthClientAudience,
): string | undefined {
  const named = cookies?.[refreshCookieNameFor(client)];
  if (typeof named === 'string' && named.trim()) return named.trim();
  const legacy = cookies?.[LEGACY_REFRESH_COOKIE_NAME];
  if (typeof legacy === 'string' && legacy.trim()) return legacy.trim();
  return undefined;
}
