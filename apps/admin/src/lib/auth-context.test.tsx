import { StrictMode, useEffect } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import { apiRequest } from '@/lib/api-client';

/**
 * The API rotates the refresh token on every POST /auth/refresh, so two
 * concurrent refreshes with the same cookie sign the admin out (the second
 * finds the session already rotated). The provider must only ever have one
 * refresh in flight.
 */

let refreshCalls = 0;
let releaseRefresh: () => void = () => {};

const admin = { id: 'u1', email: 'm@example.com', platformRole: 'SUPER_ADMIN' };

vi.mock('@/lib/api-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api-client')>('@/lib/api-client');
  return {
    ...actual,
    api: {
      ...actual.api,
      post: vi.fn(async (path: string) => {
        if (path !== '/auth/refresh') throw new Error(`unexpected POST ${path}`);
        refreshCalls += 1;
        // A rotated cookie: any refresh after the first is refused.
        if (refreshCalls > 1) throw new actual.ApiError(401, 'UNAUTHORIZED', 'Refresh token has been revoked');
        await new Promise<void>((resolve) => (releaseRefresh = resolve));
        return { success: true, data: { accessToken: 'access-1', user: admin } };
      }),
      get: vi.fn(async () => ({ success: true, data: admin })),
    },
  };
});

function Probe() {
  const { user, loading } = useAuth();
  return <p>{loading ? 'loading' : user ? `signed in as ${user.email}` : 'signed out'}</p>;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AuthProvider start-up refresh', () => {
  it('sends a single refresh even when React runs the start-up effect twice', async () => {
    refreshCalls = 0;
    render(
      <StrictMode>
        <AuthProvider>
          <Probe />
        </AuthProvider>
      </StrictMode>,
    );
    await waitFor(() => expect(refreshCalls).toBe(1));
    releaseRefresh();
    expect(await screen.findByText('signed in as m@example.com')).toBeInTheDocument();
    expect(refreshCalls).toBe(1);
  });

  it('gives a page its access token on its very first fetch (no 401 + second refresh)', async () => {
    refreshCalls = 0;
    const authHeaders: Array<string | undefined> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        authHeaders.push((init.headers as Record<string, string>).Authorization);
        return new Response(JSON.stringify({ success: true, data: { items: [] } }), { status: 200 });
      }),
    );

    // Mirrors a dashboard page: it fetches in a mount effect, which React runs
    // before the provider's own effects in the commit that reveals it.
    function Page() {
      const { user } = useAuth();
      useEffect(() => {
        if (user) void apiRequest('/admin/affiliates');
      }, [user]);
      return <p>page</p>;
    }
    function Gate() {
      const { user } = useAuth();
      return user ? <Page /> : <p>checking</p>;
    }

    render(
      <AuthProvider>
        <Gate />
      </AuthProvider>,
    );
    await waitFor(() => expect(refreshCalls).toBe(1));
    releaseRefresh();
    await screen.findByText('page');
    await waitFor(() => expect(authHeaders).toHaveLength(1));
    expect(authHeaders[0]).toBe('Bearer access-1');
    expect(refreshCalls).toBe(1);
  });
});
