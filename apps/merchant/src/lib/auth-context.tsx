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
  logout: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
  reloadProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const clearSession = useCallback(() => {
    setAccessToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    configureApiClient({
      getAccessToken: () => accessToken,
      onUnauthorized: clearSession,
      refreshAccessToken: async () => {
        try {
          const refreshed = await api.post<{
            success: true;
            data: { accessToken: string };
          }>('/auth/refresh', {}, { token: null });
          setAccessToken(refreshed.data.accessToken);
          return refreshed.data.accessToken;
        } catch {
          clearSession();
          return null;
        }
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
    try {
      const refreshed = await api.post<{
        success: true;
        data: { accessToken: string };
      }>('/auth/refresh', {}, { token: null });
      setAccessToken(refreshed.data.accessToken);
      await loadProfile(refreshed.data.accessToken);
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
