import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InventoryPage from '@/app/dashboard/inventory/page';
import InventoryMovementsPage from '@/app/dashboard/inventory/[inventoryItemId]/page';
import { ApiError } from '@/lib/api-client';

const pushToast = vi.fn();
let selectedStoreId = 'store-1';
let canManage = true;

vi.mock('next/navigation', () => ({
  useParams: () => ({ inventoryItemId: 'inv-1' }),
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

vi.mock('@/lib/store-context', () => ({
  useStoreContext: () => ({
    selectedStoreId,
    selectedStore: {
      id: selectedStoreId,
      tenantId: 'tenant-1',
      name: 'Alpha',
      slug: 'alpha',
      status: 'ACTIVE',
      currency: 'USD',
      timezone: 'UTC',
      locale: 'en-US',
      createdAt: '',
      updatedAt: '',
    },
    stores: [],
    loading: false,
    error: null,
    setSelectedStoreId: vi.fn(),
    refreshStores: vi.fn(),
  }),
}));

vi.mock('@/lib/permissions', () => ({
  useCanManageStore: () => canManage,
}));

vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ pushToast }),
}));

const api = {
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
};

vi.mock('@/lib/api-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api-client')>(
    '@/lib/api-client',
  );
  return {
    ...actual,
    api: {
      get: (...args: unknown[]) => api.get(...args),
      post: (...args: unknown[]) => api.post(...args),
      patch: (...args: unknown[]) => api.patch(...args),
      delete: (...args: unknown[]) => api.delete(...args),
    },
  };
});

const inventoryItem = {
  id: 'inv-1',
  storeId: 'store-1',
  productId: 'prod-1',
  variantId: null,
  quantity: 2,
  reservedQuantity: 0,
  lowStockThreshold: 5,
  availableQuantity: 2,
  product: { id: 'prod-1', name: 'Tee', sku: 'TEE-1' },
  variant: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
};

describe('Inventory UI', () => {
  beforeEach(() => {
    selectedStoreId = 'store-1';
    canManage = true;
    pushToast.mockReset();
    api.get.mockReset();
    api.post.mockReset();
  });

  it('loads inventory list and low-stock state', async () => {
    api.get.mockImplementation(async (path: string) => {
      if (path.includes('/inventory?')) {
        return {
          success: true,
          data: {
            items: [inventoryItem],
            meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
          },
        };
      }
      return {
        success: true,
        data: {
          items: [
            {
              id: 'prod-1',
              storeId: 'store-1',
              name: 'Tee',
              slug: 'tee',
              description: null,
              shortDescription: null,
              status: 'ACTIVE',
              productType: 'PHYSICAL',
              sku: 'TEE-1',
              barcode: null,
              basePrice: '10.00',
              compareAtPrice: null,
              costPrice: null,
              trackInventory: true,
              allowBackorder: false,
              categoryIds: [],
              categories: [],
              createdAt: '',
              updatedAt: '',
            },
          ],
          meta: { total: 1, page: 1, limit: 100, totalPages: 1 },
        },
      };
    });

    render(<InventoryPage />);
    expect((await screen.findAllByRole('cell', { name: 'Tee' })).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Low stock').length).toBeGreaterThan(0);
  });

  it('adjusts inventory with confirmation', async () => {
    const user = userEvent.setup();
    api.get.mockImplementation(async (path: string) => {
      if (path.includes('/inventory?')) {
        return {
          success: true,
          data: {
            items: [inventoryItem],
            meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
          },
        };
      }
      if (path.includes('/variants')) {
        return { success: true, data: [] };
      }
      return {
        success: true,
        data: { items: [], meta: { total: 0, page: 1, limit: 100, totalPages: 0 } },
      };
    });
    api.post.mockResolvedValue({ success: true, data: inventoryItem });

    render(<InventoryPage />);
    await screen.findAllByRole('cell', { name: 'Tee' });
    await user.click(screen.getAllByRole('button', { name: /^adjust$/i })[0]!);
    await user.clear(screen.getByLabelText(/quantity delta/i));
    await user.type(screen.getByLabelText(/quantity delta/i), '3');
    await user.click(screen.getByRole('button', { name: /apply adjustment/i }));

    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /^apply$/i }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        '/stores/store-1/inventory/adjust',
        expect.objectContaining({
          productId: 'prod-1',
          quantity: 3,
          type: 'ADJUSTMENT',
        }),
      );
    });
    expect(pushToast).toHaveBeenCalledWith('Inventory adjusted.', 'success');
  });

  it('shows adjustment failure without retry', async () => {
    const user = userEvent.setup();
    api.get.mockImplementation(async (path: string) => {
      if (path.includes('/inventory?')) {
        return {
          success: true,
          data: {
            items: [inventoryItem],
            meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
          },
        };
      }
      return {
        success: true,
        data: { items: [], meta: { total: 0, page: 1, limit: 100, totalPages: 0 } },
      };
    });
    api.post.mockRejectedValue(
      new ApiError(409, 'CONFLICT', 'Stock cannot become negative'),
    );

    render(<InventoryPage />);
    await screen.findAllByRole('cell', { name: 'Tee' });
    await user.click(screen.getAllByRole('button', { name: /^adjust$/i })[0]!);
    await user.clear(screen.getByLabelText(/quantity delta/i));
    await user.type(screen.getByLabelText(/quantity delta/i), '-99');
    await user.click(screen.getByRole('button', { name: /apply adjustment/i }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /^apply$/i }));

    await waitFor(() => {
      expect(pushToast).toHaveBeenCalledWith(
        expect.stringMatching(/negative|rejected|adjust/i),
        'error',
      );
    });
    expect(api.post).toHaveBeenCalledTimes(1);
  });

  it('loads movement history', async () => {
    api.get.mockImplementation(async (path: string) => {
      if (path.endsWith('/inventory/inv-1')) {
        return { success: true, data: inventoryItem };
      }
      return {
        success: true,
        data: {
          items: [
            {
              id: 'mov-1',
              storeId: 'store-1',
              productId: 'prod-1',
              variantId: null,
              type: 'ADJUSTMENT',
              quantity: 5,
              referenceType: null,
              referenceId: null,
              note: 'Restock',
              createdAt: '2026-01-03T00:00:00.000Z',
            },
          ],
          meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
        },
      };
    });

    render(<InventoryMovementsPage />);
    expect(await screen.findByText('ADJUSTMENT')).toBeInTheDocument();
    expect(screen.getByText('Restock')).toBeInTheDocument();
  });
});
