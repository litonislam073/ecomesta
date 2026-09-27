import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const getMock = vi.fn();
const postMock = vi.fn();
const patchMock = vi.fn();
const deleteMock = vi.fn();

vi.mock('@/lib/api-client', () => ({
  ApiError: class ApiError extends Error {
    status: number;
    code: string;
    constructor(status: number, code: string, message: string) {
      super(message);
      this.status = status;
      this.code = code;
    }
  },
  api: {
    get: (...args: unknown[]) => getMock(...args),
    post: (...args: unknown[]) => postMock(...args),
    patch: (...args: unknown[]) => patchMock(...args),
    delete: (...args: unknown[]) => deleteMock(...args),
  },
}));

vi.mock('@/lib/store-context', () => ({
  useStoreContext: () => ({
    selectedStoreId: 'store-1',
    stores: [{ id: 'store-1', slug: 'demo', name: 'Demo' }],
    selectedStore: { id: 'store-1', slug: 'demo', name: 'Demo' },
  }),
}));

vi.mock('@/lib/permissions', () => ({
  useCanManageStore: () => true,
}));

vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ pushToast: vi.fn() }),
}));

describe('Shipping dashboard', () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
    patchMock.mockReset();
    deleteMock.mockReset();

    getMock.mockImplementation(async (path: string) => {
      const p = String(path);
      if (p.includes('/shipping-zones')) {
        return {
          success: true,
          data: {
            items: [
              {
                id: 'zone-1',
                storeId: 'store-1',
                name: 'Dhaka City',
                active: true,
                priority: 100,
                locations: [
                  {
                    id: 'loc-1',
                    divisionId: null,
                    districtId: 'dist-1',
                    upazilaId: null,
                    division: null,
                    district: { id: 'dist-1', name: 'Dhaka', code: 'D' },
                    upazila: null,
                  },
                ],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            ],
            meta: { page: 1, limit: 100, total: 1, totalPages: 1 },
          },
        };
      }
      if (p.includes('/shipping-methods')) {
        return {
          success: true,
          data: {
            items: [
              {
                id: 'm1',
                storeId: 'store-1',
                name: 'Dhaka Delivery',
                type: 'FLAT',
                provider: 'MANUAL',
                price: '60.00',
                active: true,
                configuration: null,
                zoneId: 'zone-1',
                freeShippingThreshold: '2000.00',
                codAllowed: true,
                estimatedDelivery: '1–2 days',
                sortOrder: 0,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            ],
            meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
          },
        };
      }
      if (p.includes('/locations/divisions')) {
        return {
          success: true,
          data: [{ id: 'div-1', code: 'DHAKA', name: 'Dhaka' }],
        };
      }
      return { success: true, data: [] };
    });
  });

  it('lists zones and methods with zone binding details', async () => {
    const ShippingPage = (await import('./page')).default;
    render(<ShippingPage />);

    expect(await screen.findByText('Dhaka City')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /^methods$/i }));
    expect(await screen.findByText('Dhaka Delivery')).toBeInTheDocument();
    expect(screen.getByText('60.00')).toBeInTheDocument();
    expect(screen.getByText('2000.00')).toBeInTheDocument();
  });

  it('opens zone create form for managers', async () => {
    const ShippingPage = (await import('./page')).default;
    const user = userEvent.setup();
    render(<ShippingPage />);

    await screen.findByText('Dhaka City');
    await user.click(screen.getByRole('button', { name: /add zone/i }));
    expect(await screen.findByText(/new shipping zone/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(getMock.mock.calls.some((c) => String(c[0]).includes('/locations/divisions'))).toBe(
        true,
      );
    });
  });
});
