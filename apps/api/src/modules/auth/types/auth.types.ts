export type TokenType = 'access' | 'refresh';

export interface AccessTokenPayload {
  sub: string;
  sid: string;
  typ: 'access';
  email: string;
  platformRole: string;
}

export interface RefreshTokenPayload {
  sub: string;
  sid: string;
  typ: 'refresh';
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
  status: string;
  platformRole: string;
  memberships: {
    tenants: TenantMembershipContext[];
    stores: StoreMembershipContext[];
  };
}

export const REFRESH_COOKIE_NAME = 'ecomesta_refresh_token';

export type AppRole =
  | 'SUPER_ADMIN'
  | 'OWNER'
  | 'ADMIN'
  | 'STAFF'
  | 'STORE_MANAGER'
  | 'STORE_STAFF';
