'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { PlatformRole } from '@ecomesta/types';
import { ApiError, api, configureApiClient } from '@/lib/api-client';

export interface AuthUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  platformRole: PlatformRole | string;
  status: string;
  memberships: {
    tenants: Array<{ tenantId: string; role: string; status: string }>;
    stores: Array<{ storeId: string; role: string; status: string }>;
  };
}

interface AuthContextValue {
  user: AuthUser | null;
  accessToken: string | null;
  loading: boolean;
  /** True only when the signed-in account carries the SUPER_ADMIN platform role. */
  isSuperAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

type RefreshResult = { accessToken: string; user: AuthUser };

let refreshInFlight: Promise<RefreshResult | null> | null = null;

/**
 * One refresh at a time in this tab. The API rotates the refresh token on
 * every call, so a second concurrent POST /auth/refresh with the same cookie
 * (the start-up refresh racing a 401 retry, or React running the start-up
 * effect twice) is refused and would sign the admin out.
 *
 * Refresh returns the user so startup can skip GET /auth/me.
 */
function refreshAccessTokenOnce(): Promise<RefreshResult | null> {
  refreshInFlight ??= api
    .post<{ success: true; data: { accessToken: string; user: AuthUser } }>(
      '/auth/refresh',
      {},
      { token: null },
    )
    .then(
      (refreshed) => ({
        accessToken: refreshed.data.accessToken,
        user: refreshed.data.user,
      }),
      () => null,
    )
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessTokenState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // The API client reads the token from this ref, which is updated in the same
  // tick as the state. Child effects (the page's first fetch) run BEFORE this
  // provider's effects, so a token that only reached the client via an effect
  // was still null on that first request: it 401'd, forced a second refresh
  // round trip and made admin lists sit on "Loading…" for seconds.
  const accessTokenRef = useRef<string | null>(null);

  const setAccessToken = useCallback((token: string | null) => {
    accessTokenRef.current = token;
    setAccessTokenState(token);
  }, []);

  const clearSession = useCallback(() => {
    setAccessToken(null);
    setUser(null);
  }, [setAccessToken]);

  // Configure during render (idempotent, only touches module state) so the
  // client is ready before any child effect fires.
  configureApiClient({
    getAccessToken: () => accessTokenRef.current,
    onUnauthorized: clearSession,
    refreshAccessToken: async () => {
      const result = await refreshAccessTokenOnce();
      if (result) {
        setAccessToken(result.accessToken);
        setUser(result.user);
        return result.accessToken;
      }
      clearSession();
      return null;
    },
  });

  const refreshSession = useCallback(async () => {
    const result = await refreshAccessTokenOnce();
    if (!result) {
      clearSession();
      return false;
    }
    try {
      setAccessToken(result.accessToken);
      setUser(result.user);
      return true;
    } catch {
      clearSession();
      return false;
    }
  }, [clearSession, setAccessToken]);

  useEffect(() => {
    void (async () => {
      await refreshSession();
      setLoading(false);
    })();
  }, [refreshSession]);

  const login = useCallback(
    async (email: string, password: string) => {
      const result = await api.post<{
        success: true;
        data: { accessToken: string; user: AuthUser };
      }>('/auth/login', { email, password }, { token: null });
      setAccessToken(result.data.accessToken);
      setUser(result.data.user);
    },
    [setAccessToken],
  );

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout', undefined, {
        token: accessToken,
      });
    } catch (error) {
      if (!(error instanceof ApiError && (error.status === 401 || error.status === 403))) {
        // Ignore logout failures after session expiry.
      }
    } finally {
      clearSession();
    }
  }, [accessToken, clearSession]);

  const value = useMemo(
    () => ({
      user,
      accessToken,
      loading,
      isSuperAdmin: user?.platformRole === 'SUPER_ADMIN',
      login,
      logout,
      refreshSession,
    }),
    [user, accessToken, loading, login, logout, refreshSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
