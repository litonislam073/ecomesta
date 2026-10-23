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
import { ApiError, api, configureApiClient } from '@/lib/api-client';
import { readReferralCode } from '@/lib/referral';

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

type RefreshResult = { accessToken: string; user: AuthUser };

let refreshInFlight: Promise<RefreshResult | null> | null = null;
/**
 * True when the last refresh failed for a reason that does not prove the
 * session is gone (offline, timeout, 5xx). A 401/403 means the refresh cookie
 * is really invalid and the session must be dropped.
 */
let lastRefreshTransient = false;

const TRANSIENT_RETRY_DELAY_MS = 800;

/** Network failures, timeouts, rate limits and server errors; not a revoked session. */
function isTransientFailure(error: unknown): boolean {
  if (error instanceof ApiError) {
    return error.status >= 500 || error.status === 408 || error.status === 429;
  }
  return true;
}

function postRefresh() {
  return api.post<{ success: true; data: { accessToken: string; user: AuthUser } }>(
    '/auth/refresh',
    {},
    { token: null },
  );
}

/**
 * One refresh at a time in this tab. The API rotates the refresh token on
 * every call, so a second concurrent POST /auth/refresh with the same cookie
 * (the start-up refresh racing a 401 retry, or React running the start-up
 * effect twice) is refused and would sign the merchant out.
 *
 * A transient failure is retried once; if it still fails, `lastRefreshTransient`
 * is set so callers keep the signed-in state instead of clearing it.
 *
 * Refresh now returns the user profile so startup can skip GET /auth/me.
 */
function refreshAccessTokenOnce(): Promise<RefreshResult | null> {
  refreshInFlight ??= (async () => {
    lastRefreshTransient = false;
    try {
      const data = (await postRefresh()).data;
      return { accessToken: data.accessToken, user: data.user };
    } catch (first) {
      if (!isTransientFailure(first)) return null;
      await new Promise((resolve) => setTimeout(resolve, TRANSIENT_RETRY_DELAY_MS));
      try {
        const data = (await postRefresh()).data;
        return { accessToken: data.accessToken, user: data.user };
      } catch (second) {
        lastRefreshTransient = isTransientFailure(second);
        return null;
      }
    }
  })().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

function assertMerchantProfile(profile: AuthUser) {
  if (
    profile.platformRole === 'SUPER_ADMIN' &&
    profile.memberships.stores.length === 0
  ) {
    throw new ApiError(
      403,
      'MERCHANT_ACCESS_DENIED',
      'This account is for the admin dashboard. Sign in with a merchant account.',
    );
  }
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
  const [accessToken, setAccessTokenState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // Same tick as state so child mount fetches see the token (parent effects run later).
  const accessTokenRef = useRef<string | null>(null);

  const setAccessToken = useCallback((token: string | null) => {
    accessTokenRef.current = token;
    setAccessTokenState(token);
  }, []);

  const clearSession = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    setSessionHint(false);
  }, [setAccessToken]);

  useEffect(() => {
    if (user) setSessionHint(true);
  }, [user]);

  configureApiClient({
    getAccessToken: () => accessTokenRef.current,
    // A 401 that follows a transient refresh failure (offline, 5xx) leaves the
    // session alone: the request fails, the next one retries the refresh.
    onUnauthorized: () => {
      if (lastRefreshTransient) return;
      clearSession();
    },
    refreshAccessToken: async () => {
      const result = await refreshAccessTokenOnce();
      if (result) {
        setAccessToken(result.accessToken);
        try {
          assertMerchantProfile(result.user);
          setUser(result.user);
        } catch {
          /* keep token; next /me-style call can correct */
        }
        return result.accessToken;
      }
      if (!lastRefreshTransient) clearSession();
      return null;
    },
  });

  const loadProfile = useCallback(async (token: string) => {
    const me = await api.get<{ success: true; data: AuthUser }>('/auth/me', {
      token,
    });
    assertMerchantProfile(me.data);
    setUser(me.data);
  }, []);

  const refreshSession = useCallback(async () => {
    const result = await refreshAccessTokenOnce();
    if (!result) {
      // Transient (offline / server error): there is nothing signed in to keep
      // in memory yet, but leave the "signed in before" hint so a reload retries.
      if (lastRefreshTransient) {
        setAccessToken(null);
        setUser(null);
      } else {
        clearSession();
      }
      return false;
    }
    try {
      setAccessToken(result.accessToken);
      assertMerchantProfile(result.user);
      setUser(result.user);
      return true;
    } catch (error) {
      if (error instanceof ApiError && error.status < 500 && error.status !== 408 && error.status !== 429) {
        clearSession();
      } else {
        // Profile could not be loaded right now; do not leave a half-signed-in zombie.
        setAccessToken(null);
        setUser(null);
      }
      return false;
    }
  }, [clearSession]);

  useEffect(() => {
    void (async () => {
      // Never signed in on this browser: there is no refresh cookie, so skip the
      // request instead of logging an expected 401 in the console.
      if (hasSessionHint()) await refreshSession();
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
      assertMerchantProfile(result.data.user);
      setUser(result.data.user);
    },
    [],
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
          referralCode: readReferralCode() ?? undefined,
        },
        { token: null },
      );
      setAccessToken(result.data.accessToken);
      // Register already returns the user — skip a redundant /auth/me round-trip.
      setUser(result.data.user);
    },
    [],
  );

  const loginWithGoogle = useCallback(
    async (credential: string) => {
      const result = await api.post<{
        success: true;
        data: { accessToken: string; created: boolean; user: AuthUser };
      }>('/auth/google', { credential, referralCode: readReferralCode() ?? undefined }, { token: null });
      setAccessToken(result.data.accessToken);
      assertMerchantProfile(result.data.user);
      setUser(result.data.user);
      return { created: result.data.created };
    },
    [],
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
