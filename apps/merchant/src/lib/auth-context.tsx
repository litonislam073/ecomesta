'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { ApiError, api, configureApiClient } from '@/lib/api-client';

export interface AuthUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  emailVerified?: boolean;
  platformRole: string;
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
  login: (email: string, password: string) => Promise<void>;
  register: (input: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
  }) => Promise<void>;
  /** Resolves `created: true` when the Google sign-in opened a new account. */
  loginWithGoogle: (credential: string) => Promise<{ created: boolean }>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
  reloadProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

let refreshInFlight: Promise<string | null> | null = null;

/**
 * One refresh at a time in this tab. The API rotates the refresh token on
 * every call, so a second concurrent POST /auth/refresh with the same cookie
 * (the start-up refresh racing a 401 retry, or React running the start-up
 * effect twice) is refused and would sign the merchant out.
 */
function refreshAccessTokenOnce(): Promise<string | null> {
  refreshInFlight ??= api
    .post<{ success: true; data: { accessToken: string } }>('/auth/refresh', {}, { token: null })
    .then(
      (refreshed) => refreshed.data.accessToken,
      () => null,
    )
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
}

/**
 * A non-secret "this browser was signed in" flag (no token, no user data). The
 * sign-in and sign-up pages use it to decide whether to wait for the session
 * check: without it they show the form at once instead of a loading state.
 */
const SESSION_HINT_KEY = 'ecomesta_signed_in';

function setSessionHint(signedIn: boolean) {
  try {
    if (signedIn) window.localStorage.setItem(SESSION_HINT_KEY, '1');
    else window.localStorage.removeItem(SESSION_HINT_KEY);
  } catch {
    /* storage unavailable: the pages simply show the form */
  }
}

/** True when this browser was signed in last time; the session check decides for sure. */
export function hasSessionHint(): boolean {
  try {
    return typeof window !== 'undefined' && window.localStorage.getItem(SESSION_HINT_KEY) === '1';
  } catch {
    return false;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const clearSession = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    setSessionHint(false);
  }, []);

  useEffect(() => {
    if (user) setSessionHint(true);
  }, [user]);

  useEffect(() => {
    configureApiClient({
      getAccessToken: () => accessToken,
      onUnauthorized: clearSession,
      refreshAccessToken: async () => {
        const token = await refreshAccessTokenOnce();
        if (token) setAccessToken(token);
        else clearSession();
        return token;
      },
    });
  }, [accessToken, clearSession]);

  const loadProfile = useCallback(async (token: string) => {
    const me = await api.get<{ success: true; data: AuthUser }>('/auth/me', {
      token,
    });
    setUser(me.data);
  }, []);

  const refreshSession = useCallback(async () => {
    const token = await refreshAccessTokenOnce();
    if (!token) {
      clearSession();
      return false;
    }
    try {
      setAccessToken(token);
      await loadProfile(token);
      return true;
    } catch {
      clearSession();
      return false;
    }
  }, [clearSession, loadProfile]);

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
      await loadProfile(result.data.accessToken);
    },
    [loadProfile],
  );

  const register = useCallback(
    async (input: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
      phone?: string;
    }) => {
      const result = await api.post<{
        success: true;
        data: { accessToken: string; user: AuthUser };
      }>(
        '/auth/register',
        {
          email: input.email,
          password: input.password,
          firstName: input.firstName,
          lastName: input.lastName,
          phone: input.phone,
        },
        { token: null },
      );
      setAccessToken(result.data.accessToken);
      await loadProfile(result.data.accessToken);
    },
    [loadProfile],
  );

  const loginWithGoogle = useCallback(
    async (credential: string) => {
      const result = await api.post<{
        success: true;
        data: { accessToken: string; created: boolean; user: AuthUser };
      }>('/auth/google', { credential }, { token: null });
      setAccessToken(result.data.accessToken);
      await loadProfile(result.data.accessToken);
      return { created: result.data.created };
    },
    [loadProfile],
  );

  const reloadProfile = useCallback(async () => {
    if (!accessToken) return;
    await loadProfile(accessToken);
  }, [accessToken, loadProfile]);

  const logout = useCallback(async () => {
    try {
      // Always hit the API so the HttpOnly refresh cookie is cleared even when
      // the in-memory access token is already gone.
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
      login,
      register,
      loginWithGoogle,
      logout,
      refreshSession,
      reloadProfile,
    }),
    [
      user,
      accessToken,
      loading,
      login,
      register,
      loginWithGoogle,
      logout,
      refreshSession,
      reloadProfile,
    ],
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
