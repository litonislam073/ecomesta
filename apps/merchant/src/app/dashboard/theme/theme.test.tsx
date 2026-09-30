import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { StoreTheme, ThemeListItem } from '@ecomesta/types';
import ThemePage from '@/app/dashboard/theme/page';
import { ApiError } from '@/lib/api-client';

const pushToast = vi.fn();
let canManage = true;

vi.mock('@/lib/store-context', () => ({
  useStoreContext: () => ({
    selectedStoreId: 'store-1',
    selectedStore: {
      id: 'store-1',
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

const storeTheme: StoreTheme = {
  id: 'st-1',
  theme: {
    id: 'theme-default',
    name: 'Default',
    slug: 'default',
    version: '1.0.0',
    previewImageUrl: null,
  },
  isActive: true,
  isLive: false,
  liveTheme: null,
  configuration: {
    branding: {
      brandName: 'Alpha Goods',
      primaryColor: '#2563eb',
      borderRadius: 'md',
    },
    typography: { headingFont: 'Inter', bodyFont: 'Inter', baseFontSize: 16 },
    announcement: {
      enabled: true,
      text: 'Free shipping over $50',
      backgroundColor: '#0f172a',
      textColor: '#ffffff',
    },
    header: {
      layout: 'classic',
      showCart: true,
      menuItems: [{ label: 'Shop', href: '/products' }],
    },
    hero: {
      enabled: true,
      headline: 'Shop the new arrivals',
      ctaLabel: 'Browse products',
      ctaHref: '/products',
      alignment: 'left',
    },
    homepage: {
      featuredCategories: [],
      featuredProducts: [],
      sections: [{ type: 'featured_products', title: 'Picks', enabled: true }],
    },
    footer: { tagline: 'Built with Ecomesta', menuItems: [], socialLinks: [] },
    seo: { title: 'Alpha Goods', description: '', keywords: [] },
  },
  publishedConfiguration: null,
  publishedAt: null,
  hasUnpublishedChanges: true,
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const themes: ThemeListItem[] = [
  {
    id: 'theme-default',
    name: 'Default',
    slug: 'default',
    version: '1.0.0',
    previewImageUrl: null,
    description: 'Balanced storefront layout.',
    selected: true,
    live: false,
  },
  {
    id: 'theme-minimal',
    name: 'Minimal',
    slug: 'minimal',
    version: '1.0.0',
    previewImageUrl: null,
    description: 'Typography-led layout.',
    selected: false,
    live: false,
  },
];

function mockLoad() {
  api.get.mockImplementation((path: string) => {
    if (path.endsWith('/themes')) {
      return Promise.resolve({
        success: true,
        data: { items: themes, meta: { total: themes.length } },
      });
    }
    return Promise.resolve({ success: true, data: storeTheme });
  });
}

describe('Theme customizer', () => {
  beforeEach(() => {
    canManage = true;
    pushToast.mockReset();
    api.get.mockReset();
    api.post.mockReset();
    api.patch.mockReset();
  });

  it('renders theme sections and the live preview from the draft config', async () => {
    mockLoad();
    render(<ThemePage />);

    expect(
      await screen.findByRole('heading', { name: /^theme$/i }),
    ).toBeInTheDocument();
    // The page heading is visible while LoadingState is up — wait for the form.
    expect(await screen.findByLabelText('Brand name')).toHaveValue('Alpha Goods');
    expect(screen.getByRole('heading', { name: 'Branding' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Typography' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Announcement bar' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Header' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Hero' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Homepage' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Footer' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'SEO' })).toBeInTheDocument();

    const preview = screen.getByRole('region', { name: 'Storefront preview' });
    expect(preview).toHaveTextContent('Free shipping over $50');
    expect(preview).toHaveTextContent('Shop the new arrivals');
    expect(preview).toHaveTextContent('Built with Ecomesta');
    expect(screen.getByTestId('theme-status')).toHaveTextContent(
      'Live on storefront: Nothing published yet',
    );
  });

  it('saves the draft with a sanitized configuration patch', async () => {
    mockLoad();
    api.patch.mockResolvedValue({ success: true, data: storeTheme });
    const user = userEvent.setup();
    render(<ThemePage />);

    const brandName = await screen.findByLabelText('Brand name');
    await user.clear(brandName);
    await user.type(brandName, 'Beta Goods');
    await user.click(screen.getByRole('button', { name: 'Save draft' }));

    await waitFor(() => expect(api.patch).toHaveBeenCalledTimes(1));
    const [path, body] = api.patch.mock.calls[0] as [
      string,
      { configuration: { branding?: { brandName?: string } } },
    ];
    expect(path).toBe('/stores/store-1/theme');
    expect(body.configuration.branding?.brandName).toBe('Beta Goods');
    expect(pushToast).toHaveBeenCalledWith('Draft saved', 'success');
  });

  it('drops invalid colors from the saved patch', async () => {
    mockLoad();
    api.patch.mockResolvedValue({ success: true, data: storeTheme });
    const user = userEvent.setup();
    render(<ThemePage />);

    const primary = await screen.findByLabelText('Primary color');
    await user.clear(primary);
    await user.type(primary, 'not-a-color');
    expect(screen.getByText(/use a hex color/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledTimes(1));
    const [, body] = api.patch.mock.calls[0] as [
      string,
      { configuration: { branding?: { primaryColor?: string } } },
    ];
    expect(body.configuration.branding?.primaryColor).toBeUndefined();
  });

  it('publishes only after the confirmation dialog is accepted', async () => {
    mockLoad();
    api.post.mockResolvedValue({
      success: true,
      data: { ...storeTheme, publishedAt: '2026-02-01T00:00:00.000Z' },
    });
    const user = userEvent.setup();
    render(<ThemePage />);

    await user.click(await screen.findByRole('button', { name: 'Publish' }));
    expect(
      screen.getByRole('dialog', { name: /publish this theme/i }),
    ).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Publish theme' }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/stores/store-1/theme/publish'),
    );
    expect(pushToast).toHaveBeenCalledWith('Theme published', 'success');
  });

  it('resets the draft after confirmation', async () => {
    mockLoad();
    api.post.mockResolvedValue({ success: true, data: storeTheme });
    const user = userEvent.setup();
    render(<ThemePage />);

    await user.click(await screen.findByRole('button', { name: 'Reset' }));
    await user.click(screen.getByRole('button', { name: 'Reset draft' }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/stores/store-1/theme/reset'),
    );
  });

  it('selects another theme as a draft only', async () => {
    mockLoad();
    api.patch.mockResolvedValue({ success: true, data: storeTheme });
    const user = userEvent.setup();
    render(<ThemePage />);

    await user.click(await screen.findByRole('button', { name: 'Edit Minimal' }));
    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith('/stores/store-1/theme', {
        themeId: 'theme-minimal',
      }),
    );
    expect(api.post).not.toHaveBeenCalled();
    expect(pushToast).toHaveBeenCalledWith(
      'Theme selected as draft. Publish to make it live.',
      'success',
    );
  });

  it('shows the live theme separately from the theme being edited', async () => {
    const editingMinimal: StoreTheme = {
      ...storeTheme,
      id: 'st-2',
      theme: { ...storeTheme.theme, id: 'theme-minimal', name: 'Minimal', slug: 'minimal' },
      isLive: false,
      liveTheme: {
        ...storeTheme.theme,
        publishedAt: '2026-02-01T00:00:00.000Z',
      },
      hasUnpublishedChanges: true,
    };
    api.get.mockImplementation((path: string) => {
      if (path.endsWith('/themes')) {
        return Promise.resolve({
          success: true,
          data: {
            items: [
              { ...themes[0], selected: false, live: true },
              { ...themes[1], selected: true, live: false },
            ],
            meta: { total: 2 },
          },
        });
      }
      return Promise.resolve({ success: true, data: editingMinimal });
    });
    render(<ThemePage />);

    const status = await screen.findByTestId('theme-status');
    expect(status).toHaveTextContent('Editing: Minimal');
    expect(status).toHaveTextContent('Live on storefront: Default');
    expect(status).toHaveTextContent('Unpublished changes');

    const defaultCard = screen.getByText('Balanced storefront layout.').closest('li')!;
    expect(defaultCard).toHaveTextContent('Live');
    expect(defaultCard).not.toHaveTextContent('Editing');
    const minimalCard = screen.getByText('Typography-led layout.').closest('li')!;
    expect(minimalCard).toHaveTextContent('Editing');
    expect(minimalCard).not.toHaveTextContent(/\bLive\b/);
  });

  it('is read-only for staff without manage access', async () => {
    canManage = false;
    mockLoad();
    render(<ThemePage />);

    expect(await screen.findByLabelText('Brand name')).toBeDisabled();
    expect(
      screen.queryByRole('button', { name: 'Save draft' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Publish' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /edit minimal/i })).not.toBeInTheDocument();
    expect(screen.getByText(/read-only access/i)).toBeInTheDocument();
  });

  it('surfaces load failures with a retry', async () => {
    api.get.mockRejectedValue(new ApiError(403, 'FORBIDDEN', 'No access'));
    render(<ThemePage />);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });
});
