import { StrictMode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '@/lib/auth-context';

/**
 * The API rotates the refresh token on every POST /auth/refresh, so two
 * concurrent refreshes with the same cookie sign the merchant out (the second
 * finds the session already rotated). The provider must only ever have one
 * refresh in flight.
 */

let refreshCalls = 0;
let releaseRefresh: () => void = () => {};

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
        return {
          success: true,
          data: {
            accessToken: 'access-1',
            user: {
              id: 'u1',
              email: 'm@example.com',
              firstName: null,
              lastName: null,
              platformRole: 'USER',
              status: 'ACTIVE',
              memberships: { tenants: [], stores: [] },
            },
          },
        };
      }),
      get: vi.fn(async () => {
        throw new Error('GET /auth/me should not run when refresh returns user');
      }),
    },
  };
});

function Probe() {
  const { user, loading } = useAuth();
  return <p>{loading ? 'loading' : user ? `signed in as ${user.email}` : 'signed out'}</p>;
}

describe('AuthProvider start-up refresh', () => {
  it('sends a single refresh even when React runs the start-up effect twice', async () => {
    refreshCalls = 0;
    window.localStorage.setItem('ecomesta_signed_in', '1');
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
  it('skips the refresh request when this browser was never signed in', async () => {
    refreshCalls = 0;
    window.localStorage.removeItem('ecomesta_signed_in');
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    expect(await screen.findByText('signed out')).toBeInTheDocument();
    expect(refreshCalls).toBe(0);
  });
});
