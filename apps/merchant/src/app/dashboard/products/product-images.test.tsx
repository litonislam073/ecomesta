import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProductsPage from '@/app/dashboard/products/page';
import NewProductPage from '@/app/dashboard/products/new/page';
import ProductDetailPage from '@/app/dashboard/products/[productId]/page';
import { ApiError } from '@/lib/api-client';

/** SF-04: merchants upload, replace and remove product images. */

const pushToast = vi.fn();
const routerPush = vi.fn();
let canManage = true;

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: routerPush }),
  useParams: () => ({ productId: 'prod-1' }),
}));

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

vi.mock('@/lib/store-context', () => ({
  useStoreContext: () => ({
    selectedStoreId: 'store-1',
    selectedStore: { id: 'store-1', tenantId: 't', name: 'Alpha', slug: 'alpha', status: 'ACTIVE', currency: 'BDT', timezone: 'UTC', locale: 'en-BD', createdAt: '', updatedAt: '' },
    stores: [],
    loading: false,
    error: null,
    setSelectedStoreId: vi.fn(),
    refreshStores: vi.fn(),
  }),
}));

vi.mock('@/lib/permissions', () => ({ useCanManageStore: () => canManage }));
vi.mock('@/components/ui/toast', () => ({ useToast: () => ({ pushToast }) }));

const api = { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn(), upload: vi.fn() };

vi.mock('@/lib/api-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api-client')>('@/lib/api-client');
  return {
    ...actual,
    api: {
      get: (...args: unknown[]) => api.get(...args),
      post: (...args: unknown[]) => api.post(...args),
      patch: (...args: unknown[]) => api.patch(...args),
      delete: (...args: unknown[]) => api.delete(...args),
      upload: (...args: unknown[]) => api.upload(...args),
    },
  };
});

const MEDIA_1 = 'http://localhost:3001/api/v1/public/media/11111111-1111-4111-8111-111111111111';
const MEDIA_2 = 'http://localhost:3001/api/v1/public/media/22222222-2222-4222-8222-222222222222';

const product = (imageUrl: string | null = null) => ({
  id: 'prod-1',
  storeId: 'store-1',
  name: 'Panjabi',
  slug: 'panjabi',
  description: null,
  shortDescription: null,
  status: 'ACTIVE' as const,
  productType: 'PHYSICAL' as const,
  sku: 'P-1',
  barcode: null,
  basePrice: '500.00',
  compareAtPrice: null,
  costPrice: null,
  trackInventory: true,
  allowBackorder: false,
  imageUrl,
  categoryIds: [],
  categories: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
});

const pngFile = () => new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'photo.png', { type: 'image/png' });

function mockDetail(imageUrl: string | null = null) {
  api.get.mockImplementation(async (path: string) => {
    if (path.includes('/categories')) return { success: true, data: { items: [], meta: { total: 0 } } };
    return { success: true, data: { ...product(imageUrl), variants: [] } };
  });
}

const productImage = () => screen.queryByRole('img', { name: 'Panjabi' });

describe('SF-04 product image — edit page', () => {
  beforeEach(() => {
    canManage = true;
    for (const fn of [pushToast, routerPush, ...Object.values(api)]) fn.mockReset();
  });

  it('uploads an image, shows it, and keeps unsaved form edits', async () => {
    mockDetail(null);
    api.upload.mockResolvedValue({ success: true, data: { ...product(MEDIA_1), updatedAt: '2026-01-03T00:00:00.000Z' } });
    const user = userEvent.setup();
    render(<ProductDetailPage />);

    expect(await screen.findByText('No image')).toBeInTheDocument();
    const name = screen.getByLabelText(/^name$/i);
    await user.clear(name);
    await user.type(name, 'Panjabi Deluxe');

    await user.upload(screen.getByLabelText('Upload product image'), pngFile());

    await waitFor(() => expect(productImage()).toHaveAttribute('src', MEDIA_1));
    const [path, form] = api.upload.mock.calls[0]!;
    expect(path).toBe('/stores/store-1/products/prod-1/image');
    expect((form as FormData).get('file')).toBeInstanceOf(File);
    expect(screen.getByRole('button', { name: 'Replace image' })).toBeInTheDocument();
    expect(screen.getByLabelText(/^name$/i)).toHaveValue('Panjabi Deluxe');
  });

  it('replaces an existing image', async () => {
    mockDetail(MEDIA_1);
    api.upload.mockResolvedValue({ success: true, data: product(MEDIA_2) });
    const user = userEvent.setup();
    render(<ProductDetailPage />);

    await waitFor(() => expect(productImage()).toHaveAttribute('src', MEDIA_1));
    await user.upload(screen.getByLabelText('Replace product image'), pngFile());
    await waitFor(() => expect(productImage()).toHaveAttribute('src', MEDIA_2));
  });

  it('removes the image after confirmation', async () => {
    mockDetail(MEDIA_1);
    api.delete.mockResolvedValue({ success: true, data: product(null) });
    const user = userEvent.setup();
    render(<ProductDetailPage />);

    await user.click(await screen.findByRole('button', { name: 'Remove' }));
    const dialog = await screen.findByRole('dialog');
    expect(api.delete).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: 'Remove image' }));

    await waitFor(() => expect(screen.getByText('No image')).toBeInTheDocument());
    expect(api.delete).toHaveBeenCalledWith('/stores/store-1/products/prod-1/image');
    expect(screen.queryByRole('button', { name: 'Remove' })).toBeNull();
  });

  it('rejects unsupported and oversized files before uploading', async () => {
    mockDetail(null);
    const user = userEvent.setup({ applyAccept: false });
    render(<ProductDetailPage />);
    const input = await screen.findByLabelText('Upload product image');

    await user.upload(input, new File(['GIF89a'], 'anim.gif', { type: 'image/gif' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Choose a JPEG, PNG or WebP image.');

    await user.upload(input, new File([new Uint8Array(1_500_001)], 'big.png', { type: 'image/png' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Image must be 1.5 MB or smaller.');
    expect(api.upload).not.toHaveBeenCalled();
  });

  it('shows the server’s reason when an upload is refused', async () => {
    mockDetail(null);
    api.upload.mockRejectedValue(new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Image must be a JPEG, PNG or WebP file'));
    const user = userEvent.setup();
    render(<ProductDetailPage />);

    await user.upload(await screen.findByLabelText('Upload product image'), pngFile());
    expect(await screen.findByRole('alert')).toHaveTextContent('Image must be a JPEG, PNG or WebP file');
    expect(screen.getByText('No image')).toBeInTheDocument();
  });

  it('disables the controls while an upload is in flight', async () => {
    mockDetail(null);
    let finish: (value: unknown) => void = () => {};
    api.upload.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const user = userEvent.setup();
    render(<ProductDetailPage />);

    await user.upload(await screen.findByLabelText('Upload product image'), pngFile());
    const busy = await screen.findByRole('button', { name: 'Uploading…' });
    expect(busy).toBeDisabled();
    expect(screen.getByLabelText('Upload product image')).toBeDisabled();

    finish({ success: true, data: product(MEDIA_1) });
    await waitFor(() => expect(productImage()).toHaveAttribute('src', MEDIA_1));
    expect(api.upload).toHaveBeenCalledTimes(1);
  });

  it('shows the image read-only without manager access, and resolves demo images', async () => {
    canManage = false;
    mockDetail('/demo-catalog/panjabi.jpg');
    render(<ProductDetailPage />);

    await waitFor(() => expect(productImage()).toHaveAttribute('src', 'http://localhost:3000/demo-catalog/panjabi.jpg'));
    expect(screen.queryByRole('button', { name: /upload image|replace image/i })).toBeNull();
    expect(screen.queryByLabelText(/product image/i, { selector: 'input' })).toBeNull();
  });
});

describe('SF-04 product image — create and list pages', () => {
  beforeEach(() => {
    // jsdom has no object URLs; browsers use them for the local preview.
    URL.createObjectURL = vi.fn(() => 'blob:preview');
    URL.revokeObjectURL = vi.fn();
    canManage = true;
    for (const fn of [pushToast, routerPush, ...Object.values(api)]) fn.mockReset();
    api.get.mockResolvedValue({ success: true, data: { items: [], meta: { total: 0 } } });
  });

  async function createWithImage(user: ReturnType<typeof userEvent.setup>) {
    render(<NewProductPage />);
    await user.upload(await screen.findByLabelText('Choose product image'), pngFile());
    expect(await screen.findByText('photo.png')).toBeInTheDocument();
    await user.type(screen.getByLabelText(/^name$/i), 'New Kurta');
    await user.click(screen.getByRole('button', { name: /create product/i }));
  }

  it('uploads the chosen image after the product is created', async () => {
    api.post.mockResolvedValue({ success: true, data: { ...product(null), id: 'prod-new' } });
    api.upload.mockResolvedValue({ success: true, data: { ...product(MEDIA_1), id: 'prod-new' } });
    const user = userEvent.setup();
    await createWithImage(user);

    await waitFor(() => expect(routerPush).toHaveBeenCalledWith('/dashboard/products/prod-new'));
    expect(api.upload.mock.calls[0]![0]).toBe('/stores/store-1/products/prod-new/image');
    expect(api.post.mock.calls[0]![1]).not.toHaveProperty('imageUrl');
  });

  it('still opens the new product when the image upload fails', async () => {
    api.post.mockResolvedValue({ success: true, data: { ...product(null), id: 'prod-new' } });
    api.upload.mockRejectedValue(new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Image must be 1.5 MB or smaller'));
    const user = userEvent.setup();
    await createWithImage(user);

    await waitFor(() => expect(routerPush).toHaveBeenCalledWith('/dashboard/products/prod-new'));
    expect(pushToast).toHaveBeenCalledWith('Image must be 1.5 MB or smaller', 'error');
  });

  it('shows thumbnails in the product list', async () => {
    api.get.mockResolvedValue({
      success: true,
      data: {
        items: [product(MEDIA_1), { ...product(null), id: 'prod-2', name: 'Plain' }],
        meta: { total: 2, page: 1, limit: 20, totalPages: 1 },
      },
    });
    const { container } = render(<ProductsPage />);
    await screen.findAllByText('Plain');
    const rows = container.querySelectorAll('tbody tr');
    expect(rows).toHaveLength(2);
    expect(rows[0]!.querySelector('img')).toHaveAttribute('src', MEDIA_1);
    expect(rows[1]!.querySelector('img')).toBeNull();
  });

  it('labels the row action Edit for managers and View for read-only staff', async () => {
    const list = { success: true, data: { items: [product(null)], meta: { total: 1, page: 1, limit: 20, totalPages: 1 } } };
    api.get.mockResolvedValue(list);
    const { unmount } = render(<ProductsPage />);
    const edit = await screen.findByRole('button', { name: 'Edit' });
    expect(edit.closest('a')).toHaveAttribute('href', '/dashboard/products/prod-1');
    expect(screen.queryByRole('button', { name: 'View' })).not.toBeInTheDocument();
    unmount();

    canManage = false;
    render(<ProductsPage />);
    const view = await screen.findByRole('button', { name: 'View' });
    expect(view.closest('a')).toHaveAttribute('href', '/dashboard/products/prod-1');
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
  });
});
