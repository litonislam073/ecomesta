import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProductsPage from '@/app/dashboard/products/page';
import NewProductPage from '@/app/dashboard/products/new/page';
import ProductDetailPage from '@/app/dashboard/products/[productId]/page';
import { ApiError } from '@/lib/api-client';

const pushToast = vi.fn();
const routerPush = vi.fn();
let selectedStoreId = 'store-1';
let canManage = true;

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: routerPush }),
  useParams: () => ({ productId: 'prod-1' }),
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

const sampleProduct = {
  id: 'prod-1',
  storeId: 'store-1',
  name: 'Tee',
  slug: 'tee',
  description: null,
  shortDescription: null,
  status: 'ACTIVE' as const,
  productType: 'PHYSICAL' as const,
  sku: 'TEE-1',
  barcode: null,
  basePrice: '19.99',
  compareAtPrice: null,
  costPrice: null,
  trackInventory: true,
  allowBackorder: false,
  onHandQuantity: 5,
  categoryIds: [],
  categories: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
};

describe('Products catalog UI', () => {
  beforeEach(() => {
    selectedStoreId = 'store-1';
    canManage = true;
    pushToast.mockReset();
    routerPush.mockReset();
    api.get.mockReset();
    api.post.mockReset();
    api.patch.mockReset();
    api.delete.mockReset();
  });

  it('loads the product list', async () => {
    api.get.mockImplementation(async (path: string) => {
      if (path.includes('/products?')) {
        return {
          success: true,
          data: {
            items: [sampleProduct],
            meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
          },
        };
      }
      return { success: true, data: { items: [], meta: { total: 0, page: 1, limit: 100, totalPages: 0 } } };
    });

    render(<ProductsPage />);
    expect((await screen.findAllByRole('link', { name: 'Tee' })).length).toBeGreaterThan(0);
    expect(screen.getByText('TEE-1')).toBeInTheDocument();
  });

  it('shows empty product state', async () => {
    api.get.mockResolvedValue({
      success: true,
      data: { items: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } },
    });

    render(<ProductsPage />);
    expect(await screen.findByText('No products yet')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /add product/i }).length).toBeGreaterThan(0);
  });

  it('creates a product', async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue({
      success: true,
      data: { items: [], meta: { total: 0, page: 1, limit: 100, totalPages: 0 } },
    });
    api.post.mockResolvedValue({ success: true, data: sampleProduct });

    render(<NewProductPage />);
    expect(await screen.findByRole('heading', { name: /add product/i })).toBeInTheDocument();
    const nameField = await screen.findByLabelText(/^name$/i);
    await user.type(nameField, 'New Tee');
    await user.clear(screen.getByLabelText(/^slug$/i));
    await user.type(screen.getByLabelText(/^slug$/i), 'new-tee');
    await user.clear(screen.getByLabelText(/base price/i));
    await user.type(screen.getByLabelText(/base price/i), '10.00');
    await user.click(screen.getByRole('button', { name: /create product/i }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        '/stores/store-1/products',
        expect.objectContaining({ name: 'New Tee', slug: 'new-tee' }),
      );
    });
    expect(pushToast).toHaveBeenCalledWith('Product created.', 'success');
  });

  it('edits a product', async () => {
    const user = userEvent.setup();
    api.get.mockImplementation(async (path: string) => {
      if (path.includes('/products/prod-1')) {
        return {
          success: true,
          data: { ...sampleProduct, variants: [] },
        };
      }
      return {
        success: true,
        data: { items: [], meta: { total: 0, page: 1, limit: 100, totalPages: 0 } },
      };
    });
    api.patch.mockResolvedValue({
      success: true,
      data: { ...sampleProduct, name: 'Tee Updated' },
    });

    render(<ProductDetailPage />);
    const nameField = await screen.findByDisplayValue('Tee');
    await user.clear(nameField);
    await user.type(nameField, 'Tee Updated');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalled();
    });
    expect(pushToast).toHaveBeenCalledWith('Product updated.', 'success');
  });

  it('requires confirmation before archive', async () => {
    const user = userEvent.setup();
    api.get.mockImplementation(async (path: string) => {
      if (path.includes('/products?')) {
        return {
          success: true,
          data: {
            items: [sampleProduct],
            meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
          },
        };
      }
      return {
        success: true,
        data: { items: [], meta: { total: 0, page: 1, limit: 100, totalPages: 0 } },
      };
    });

    render(<ProductsPage />);
    await screen.findAllByRole('link', { name: 'Tee' });
    await user.click(screen.getAllByRole('button', { name: /^archive$/i })[0]!);
    expect(screen.getByText(/archive this product/i)).toBeInTheDocument();
    expect(api.delete).not.toHaveBeenCalled();
  });

  it('archives a product after confirmation', async () => {
    const user = userEvent.setup();
    api.get.mockImplementation(async (path: string) => {
      if (path.includes('/products?')) {
        return {
          success: true,
          data: {
            items: [sampleProduct],
            meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
          },
        };
      }
      return {
        success: true,
        data: { items: [], meta: { total: 0, page: 1, limit: 100, totalPages: 0 } },
      };
    });
    api.delete.mockResolvedValue({ success: true, data: sampleProduct });

    render(<ProductsPage />);
    await screen.findAllByRole('link', { name: 'Tee' });
    await user.click(screen.getAllByRole('button', { name: /^archive$/i })[0]!);
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /^archive$/i }));

    await waitFor(() => {
      expect(api.delete).toHaveBeenCalledWith('/stores/store-1/products/prod-1');
    });
    expect(pushToast).toHaveBeenCalledWith('Product archived.', 'success');
  });

  it('shows product API errors', async () => {
    api.get.mockRejectedValue(new ApiError(500, 'SERVER', 'Server error'));
    render(<ProductsPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Server error');
  });

  it('hides write actions without manage permission', async () => {
    canManage = false;
    api.get.mockImplementation(async (path: string) => {
      if (path.includes('/products?')) {
        return {
          success: true,
          data: {
            items: [sampleProduct],
            meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
          },
        };
      }
      return {
        success: true,
        data: { items: [], meta: { total: 0, page: 1, limit: 100, totalPages: 0 } },
      };
    });

    render(<ProductsPage />);
    await screen.findAllByRole('link', { name: 'Tee' });
    expect(screen.queryByRole('button', { name: /^archive$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add product/i })).not.toBeInTheDocument();
  });
});

describe('Variants UI', () => {
  beforeEach(() => {
    selectedStoreId = 'store-1';
    canManage = true;
    pushToast.mockReset();
    api.get.mockReset();
    api.post.mockReset();
    api.patch.mockReset();
    api.delete.mockReset();
  });

  const variant = {
    id: 'var-1',
    storeId: 'store-1',
    productId: 'prod-1',
    name: 'Large',
    sku: 'TEE-L',
    barcode: null,
    price: '21.00',
    compareAtPrice: null,
    costPrice: null,
    weight: null,
    status: 'ACTIVE' as const,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  function mockProductDetail(variants = [variant]) {
    api.get.mockImplementation(async (path: string) => {
      if (path.includes('/products/prod-1')) {
        return { success: true, data: { ...sampleProduct, variants } };
      }
      return {
        success: true,
        data: { items: [], meta: { total: 0, page: 1, limit: 100, totalPages: 0 } },
      };
    });
  }

  it('lists variants', async () => {
    mockProductDetail();
    render(<ProductDetailPage />);
    expect((await screen.findAllByRole('cell', { name: 'Large' })).length).toBeGreaterThan(0);
    expect(screen.getByText('TEE-L')).toBeInTheDocument();
  });

  it('creates a variant', async () => {
    const user = userEvent.setup();
    mockProductDetail([]);
    api.post.mockResolvedValue({ success: true, data: variant });

    render(<ProductDetailPage />);
    await screen.findByText('No variants');
    await user.click(screen.getAllByRole('button', { name: /add variant/i })[0]!);
    const form = screen.getByRole('button', { name: /create variant/i }).closest('form')!;
    await user.type(within(form).getByLabelText(/^name$/i), 'Large');
    await user.clear(within(form).getByLabelText(/^price$/i));
    await user.type(within(form).getByLabelText(/^price$/i), '21.00');
    await user.click(screen.getByRole('button', { name: /create variant/i }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        '/stores/store-1/products/prod-1/variants',
        expect.objectContaining({ name: 'Large' }),
      );
    });
  });

  it('updates a variant', async () => {
    const user = userEvent.setup();
    mockProductDetail();
    api.patch.mockResolvedValue({ success: true, data: { ...variant, name: 'XL' } });

    render(<ProductDetailPage />);
    await screen.findAllByRole('cell', { name: 'Large' });
    await user.click(screen.getAllByRole('button', { name: /^edit$/i })[0]!);
    const form = screen.getByRole('button', { name: /update variant/i }).closest('form')!;
    await user.clear(within(form).getByLabelText(/^name$/i));
    await user.type(within(form).getByLabelText(/^name$/i), 'XL');
    await user.click(screen.getByRole('button', { name: /update variant/i }));

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalled();
    });
    expect(pushToast).toHaveBeenCalledWith('Variant updated.', 'success');
  });

  it('deletes a variant with confirmation', async () => {
    const user = userEvent.setup();
    mockProductDetail();
    api.delete.mockResolvedValue({ success: true, data: { id: 'var-1', deleted: true } });

    render(<ProductDetailPage />);
    await screen.findAllByRole('cell', { name: 'Large' });
    await user.click(screen.getAllByRole('button', { name: /^delete$/i })[0]!);
    expect(screen.getByText(/delete this variant/i)).toBeInTheDocument();
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /^delete$/i }));

    await waitFor(() => {
      expect(api.delete).toHaveBeenCalledWith(
        '/stores/store-1/products/prod-1/variants/var-1',
      );
    });
  });
});
