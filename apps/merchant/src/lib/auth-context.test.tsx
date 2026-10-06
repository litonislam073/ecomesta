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
        return { success: true, data: { accessToken: 'access-1' } };
      }),
      get: vi.fn(async () => ({ success: true, data: { id: 'u1', email: 'm@example.com', platformRole: 'USER' } })),
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
});
