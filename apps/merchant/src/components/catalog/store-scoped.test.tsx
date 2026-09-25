import { useEffect, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { StoreScoped } from '@/components/catalog/store-scoped';
import { api } from '@/lib/api-client';

let selectedStoreId = 'store-1';

vi.mock('@/lib/store-context', () => ({
  useStoreContext: () => ({
    selectedStoreId,
    selectedStore: null,
    stores: [],
    loading: false,
    error: null,
    setSelectedStoreId: vi.fn(),
    refreshStores: vi.fn(),
  }),
}));

vi.mock('@/lib/api-client', () => ({
  api: {
    get: vi.fn(),
  },
}));

function CatalogProbe() {
  const [label, setLabel] = useState('loading');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await api.get<{ success: true; data: { name: string } }>(
        `/stores/${selectedStoreId}/products/probe`,
      );
      if (!cancelled) setLabel(result.data.name);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return <p>{label}</p>;
}

describe('Store switching', () => {
  it('remounts scoped catalog UI so previous store data is cleared', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockImplementation(async (path: string) => {
      if (path.includes('store-1')) {
        return { success: true, data: { name: 'Store One Product' } };
      }
      return { success: true, data: { name: 'Store Two Product' } };
    });

    selectedStoreId = 'store-1';
    const { rerender } = render(
      <StoreScoped>
        <CatalogProbe />
      </StoreScoped>,
    );

    expect(await screen.findByText('Store One Product')).toBeInTheDocument();

    selectedStoreId = 'store-2';
    rerender(
      <StoreScoped>
        <CatalogProbe />
      </StoreScoped>,
    );

    await waitFor(() => {
      expect(screen.getByText('Store Two Product')).toBeInTheDocument();
    });
    expect(screen.queryByText('Store One Product')).not.toBeInTheDocument();
  });
});
