import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import type { MediaItem } from '@ecomesta/types';
import GalleryPage from '@/app/dashboard/gallery/page';
import ProductDetailPage from '@/app/dashboard/products/[productId]/page';
import { ImageField } from '@/components/media/image-field';
import { ApiError } from '@/lib/api-client';
import { IMAGE_GUIDES } from '@/lib/media';

/** Media gallery: logo/favicon/background uploads with size notes, reuse, deletion. */

const pushToast = vi.fn();
let canManage = true;

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
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

const url = (n: number) => `http://localhost:3001/api/v1/public/media/0000000${n}-0000-4000-8000-000000000000`;

function media(n: number, extra: Partial<MediaItem> = {}): MediaItem {
  return {
    id: `0000000${n}-0000-4000-8000-000000000000`,
    url: url(n),
    filename: `image-${n}.png`,
    mimeType: 'image/png',
    size: 20480,
    width: 512,
    height: 512,
    createdAt: '2026-10-01T00:00:00.000Z',
    usedBy: [],
    ...extra,
  };
}

const page = (items: MediaItem[]) => ({
  success: true,
  data: { items, meta: { total: items.length, page: 1, limit: 24, totalPages: 1 } },
});

const pngFile = (name = 'logo.png') => new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], name, { type: 'image/png' });

function Harness({ purpose, initial = '' }: { purpose: 'logo' | 'favicon' | 'background'; initial?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <ImageField label={IMAGE_GUIDES[purpose].title} purpose={purpose} storeId="store-1" value={value} onChange={setValue} />
      <output data-testid="value">{value}</output>
    </>
  );
}

beforeEach(() => {
  canManage = true;
  for (const fn of [pushToast, ...Object.values(api)]) fn.mockReset();
});

describe('ImageField (theme logo, favicon, background)', () => {
  it('shows the size note for each purpose', () => {
    render(
      <>
        <Harness purpose="logo" />
        <Harness purpose="favicon" />
        <Harness purpose="background" />
      </>,
    );
    expect(screen.getByText(/512 × 512 px recommended \(at least 160 × 160 px\).*40 × 40 px/)).toBeInTheDocument();
    expect(screen.getByText(/Must be square: 512 × 512 px recommended/)).toBeInTheDocument();
    expect(screen.getByText(/1920 × 800 px recommended/)).toBeInTheDocument();
  });

  it('uploads a logo to the gallery and uses its URL', async () => {
    api.upload.mockResolvedValue({ success: true, data: media(1) });
    const user = userEvent.setup();
    render(<Harness purpose="logo" />);
    await user.upload(screen.getByLabelText('Upload logo'), pngFile());
    await waitFor(() => expect(screen.getByTestId('value')).toHaveTextContent(url(1)));
    const [path, form] = api.upload.mock.calls[0]!;
    expect(path).toBe('/stores/store-1/media?purpose=logo');
    expect((form as FormData).get('file')).toBeInstanceOf(File);
    expect(screen.getByRole('img', { name: 'Logo preview' })).toHaveAttribute('src', url(1));
  });

  it('shows the server reason when a favicon is not square', async () => {
    api.upload.mockRejectedValue(new ApiError(422, 'UNPROCESSABLE_ENTITY', 'Favicon must be square (this image is 64×32 pixels)'));
    const user = userEvent.setup();
    render(<Harness purpose="favicon" />);
    await user.upload(screen.getByLabelText('Upload favicon'), pngFile('wide.png'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Favicon must be square');
    expect(screen.getByTestId('value')).toBeEmptyDOMElement();
  });

  it('rejects the wrong file type before uploading', async () => {
    const user = userEvent.setup({ applyAccept: false });
    render(<Harness purpose="background" />);
    await user.upload(
      screen.getByLabelText('Upload background image'),
      new File(['x'], 'notes.txt', { type: 'text/plain' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('Choose a JPEG, PNG or WebP image.');
    expect(api.upload).not.toHaveBeenCalled();
  });

  it('picks an image from the gallery; non-square images cannot be a favicon', async () => {
    api.get.mockResolvedValue(page([media(1, { width: 1920, height: 800, filename: 'banner.jpg' }), media(2)]));
    const user = userEvent.setup();
    render(<Harness purpose="favicon" />);
    await user.click(screen.getByRole('button', { name: 'Choose from gallery' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('button', { name: 'banner.jpg (not square)' })).toBeDisabled();
    await user.click(within(dialog).getByRole('button', { name: 'Use image-2.png' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByTestId('value')).toHaveTextContent(url(2));
  });

  it('removes the image and keeps the URL field editable', async () => {
    const user = userEvent.setup();
    render(<Harness purpose="logo" initial={url(1)} />);
    await user.click(screen.getByRole('button', { name: 'Remove' }));
    expect(screen.getByTestId('value')).toBeEmptyDOMElement();
    await user.type(screen.getByLabelText(/^Logo URL/), 'https://cdn.example.com/logo.png');
    expect(screen.getByTestId('value')).toHaveTextContent('https://cdn.example.com/logo.png');
  });
});

describe('Gallery page', () => {
  it('lists every image with size, usage and a size guide', async () => {
    api.get.mockResolvedValue(
      page([media(1, { usedBy: [{ kind: 'theme', id: null, label: 'Default theme logo (published)' }] }), media(2, { mimeType: 'image/jpeg', width: 1920, height: 800 })]),
    );
    render(<GalleryPage />);
    const list = await screen.findByRole('list', { name: 'Gallery images' });
    const cards = within(list).getAllByRole('listitem');
    expect(cards).toHaveLength(2);
    expect(within(cards[0]!).getByText(/512 × 512 px · 20 KB · PNG/)).toBeInTheDocument();
    expect(within(cards[0]!).getByText('Used by: Default theme logo (published)')).toBeInTheDocument();
    expect(within(cards[0]!).getByRole('button', { name: 'Delete' })).toBeDisabled();
    expect(within(cards[1]!).getByText('Not used yet')).toBeInTheDocument();
    expect(screen.getByText('Recommended image sizes')).toBeInTheDocument();
  });

  it('uploads several images and reports the ones that failed', async () => {
    api.get.mockResolvedValue(page([]));
    api.upload
      .mockResolvedValueOnce({ success: true, data: media(1) })
      .mockRejectedValueOnce(new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Image must be 1.5 MB or smaller'));
    const user = userEvent.setup();
    render(<GalleryPage />);
    await screen.findByText('No images yet');
    await user.upload(screen.getByLabelText('Upload images to the gallery'), [pngFile('a.png'), pngFile('b.png')]);
    expect(await screen.findByRole('alert')).toHaveTextContent('b.png: Image must be 1.5 MB or smaller');
    expect(api.upload).toHaveBeenCalledTimes(2);
    expect(api.upload.mock.calls[0]![0]).toBe('/stores/store-1/media?purpose=general');
    expect(pushToast).toHaveBeenCalledWith('Image added to the gallery', 'success');
  });

  it('deletes an unused image after confirmation', async () => {
    api.get.mockResolvedValueOnce(page([media(1)])).mockResolvedValue(page([]));
    api.delete.mockResolvedValue({ success: true, data: { id: media(1).id } });
    const user = userEvent.setup();
    render(<GalleryPage />);
    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete image' }));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith(`/stores/store-1/media/${media(1).id}`));
    expect(await screen.findByText('No images yet')).toBeInTheDocument();
  });

  it('is read-only for staff', async () => {
    canManage = false;
    api.get.mockResolvedValue(page([media(1)]));
    render(<GalleryPage />);
    await screen.findByRole('list', { name: 'Gallery images' });
    expect(screen.queryByRole('button', { name: 'Upload images' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy URL' })).toBeInTheDocument();
  });
});

describe('Product image from the gallery', () => {
  it('sets the product image to a chosen gallery image', async () => {
    const product = {
      id: 'prod-1', storeId: 'store-1', name: 'Panjabi', slug: 'panjabi', description: null, shortDescription: null,
      status: 'ACTIVE', productType: 'PHYSICAL', sku: 'P-1', barcode: null, basePrice: '500.00', compareAtPrice: null,
      costPrice: null, trackInventory: true, allowBackorder: false, imageUrl: null as string | null, categoryIds: [],
      categories: [], createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-02T00:00:00.000Z', variants: [],
    };
    api.get.mockImplementation(async (path: string) => {
      if (path.includes('/media')) return page([media(3, { filename: 'kurta.jpg' })]);
      if (path.includes('/categories')) return { success: true, data: { items: [], meta: { total: 0 } } };
      return { success: true, data: product };
    });
    api.post.mockResolvedValue({ success: true, data: { ...product, imageUrl: url(3) } });
    const user = userEvent.setup();
    render(<ProductDetailPage />);
    expect(await screen.findByText('No image')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Choose from gallery' }));
    await user.click(await screen.findByRole('button', { name: 'Use kurta.jpg' }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/stores/store-1/products/prod-1/image/from-gallery', { mediaId: media(3).id }),
    );
    await waitFor(() => expect(screen.getByRole('img', { name: 'Panjabi' })).toHaveAttribute('src', url(3)));
  });
});
