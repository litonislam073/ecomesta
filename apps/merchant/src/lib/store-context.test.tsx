import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { StoreProvider, useStoreContext } from '@/lib/store-context';

const get = vi.fn();

let authState: {
  accessToken: string | null;
  user: {
    id: string;
    memberships: { stores: Array<{ storeId: string; role: string; status: string }> };
  } | null;
};

vi.mock('@/lib/api-client', () => ({
  api: {
    get: (...args: unknown[]) => get(...args),
  },
}));

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => authState,
}));

function StoreProbe() {
  const { stores, selectedStoreId, loading } = useStoreContext();
  return (
    <div>
      <p data-testid="loading">{loading ? 'loading' : 'ready'}</p>
      <p data-testid="count">{stores.length}</p>
      <p data-testid="selected">{selectedStoreId ?? 'none'}</p>
      <ul>
        {stores.map((store) => (
          <li key={store.id}>{store.name}</li>
        ))}
      </ul>
    </div>
  );
}

describe('StoreProvider membership refresh', () => {
  beforeEach(() => {
    get.mockReset();
    window.sessionStorage.clear();
    authState = {
      accessToken: 'token-1',
      user: {
        id: 'user-1',
        memberships: { stores: [] },
      },
    };
  });

  afterEach(() => {
    cleanup();
  });

  it('reloads stores when memberships change after onboarding', async () => {
    get.mockResolvedValueOnce({ success: true, data: [] });

    const { rerender } = render(
      <StoreProvider>
        <StoreProbe />
      </StoreProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('count')).toHaveTextContent('0');
    });
    expect(get).toHaveBeenCalledWith('/stores', { token: 'token-1' });

    authState = {
      accessToken: 'token-1',
      user: {
        id: 'user-1',
        memberships: {
          stores: [
            { storeId: 'store-1', role: 'STORE_MANAGER', status: 'ACTIVE' },
          ],
        },
      },
    };

    get.mockResolvedValueOnce({
      success: true,
      data: [
        {
          id: 'store-1',
          tenantId: 'tenant-1',
          name: 'My Test Shop',
          slug: 'my-test-shop',
          status: 'ACTIVE',
          currency: 'BDT',
          timezone: 'Asia/Dhaka',
          locale: 'en-BD',
          createdAt: '2026-09-26T00:00:00.000Z',
          updatedAt: '2026-09-26T00:00:00.000Z',
        },
      ],
    });

    rerender(
      <StoreProvider>
        <StoreProbe />
      </StoreProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('count')).toHaveTextContent('1');
    });
    expect(screen.getByText('My Test Shop')).toBeInTheDocument();
    expect(screen.getByTestId('selected')).toHaveTextContent('store-1');
    expect(get).toHaveBeenCalledTimes(2);
  });
});
