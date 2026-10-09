import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { StoreTheme, ThemeListItem } from '@ecomesta/types';
import ThemeLibraryPage from '@/app/dashboard/theme/page';

const push = vi.fn();
const pushToast = vi.fn();
let canManage = true;

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/dashboard/theme',
}));
vi.mock('@/lib/store-context', () => ({
  useStoreContext: () => ({
    selectedStoreId: 'store-1',
    selectedStore: { id: 'store-1', name: 'Alpha', slug: 'alpha' },
    stores: [],
    loading: false,
    error: null,
    setSelectedStoreId: vi.fn(),
    refreshStores: vi.fn(),
  }),
}));
vi.mock('@/lib/permissions', () => ({ useCanManageStore: () => canManage }));
vi.mock('@/components/ui/toast', () => ({ useToast: () => ({ pushToast }) }));

const api = { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() };
vi.mock('@/lib/api-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api-client')>('@/lib/api-client');
  return {
    ...actual,
    api: {
      get: (...a: unknown[]) => api.get(...a),
      post: (...a: unknown[]) => api.post(...a),
      patch: (...a: unknown[]) => api.patch(...a),
      delete: (...a: unknown[]) => api.delete(...a),
    },
  };
});

const summary = (id: string, name: string, slug: string) => ({ id, name, slug, version: '1.0.0', previewImageUrl: null });

const storeTheme = (over: Partial<StoreTheme> = {}): StoreTheme => ({
  id: 'st-1',
  theme: summary('theme-default', 'Default', 'default'),
  isActive: true,
  isLive: true,
  liveTheme: { ...summary('theme-default', 'Default', 'default'), publishedAt: '2026-10-01T10:00:00.000Z' },
  configuration: { hero: { enabled: true, headline: 'Welcome to Alpha' } },
  publishedConfiguration: {},
  publishedAt: '2026-10-01T10:00:00.000Z',
  hasUnpublishedChanges: false,
  updatedAt: '2026-10-01T10:00:00.000Z',
  ...over,
});

const item = (over: Partial<ThemeListItem>): ThemeListItem => ({
  ...summary('theme-x', 'X', 'x'),
  description: null,
  selected: false,
  live: false,
  premium: false,
  priceBdt: null,
  access: 'free',
  purchase: null,
  ...over,
});

const THEMES: ThemeListItem[] = [
  item({ ...summary('theme-default', 'Default', 'default'), selected: true, live: true }),
  item({ ...summary('theme-minimal', 'Minimal', 'minimal'), description: 'Typography-led layout.', access: 'included' }),
  item({
    ...summary('theme-shopease', 'ShopEase', 'shopease'),
    description: 'Premium storefront.',
    premium: true,
    priceBdt: '999.00',
    access: 'locked',
  }),
];

function mockLoad(theme: StoreTheme = storeTheme(), list: ThemeListItem[] = THEMES) {
  api.get.mockImplementation((path: string) => {
    if (path.endsWith('/themes')) return Promise.resolve({ success: true, data: { items: list } });
    if (path === '/billing/payment-accounts') {
      return Promise.resolve({ success: true, data: [{ method: 'BKASH', label: 'bKash', number: '01700000000', transferType: 'Send Money' }] });
    }
    return Promise.resolve({ success: true, data: theme });
  });
}

describe('Theme library', () => {
  beforeEach(() => {
    canManage = true;
    push.mockReset();
    pushToast.mockReset();
    api.get.mockReset();
    api.patch.mockReset();
    api.post.mockReset();
  });

  it('shows the active theme with Customize and View store', async () => {
    mockLoad();
    render(<ThemeLibraryPage />);
    const current = (await screen.findByRole('heading', { name: 'Default' })).closest('section')!;
    expect(within(current).getByText('Active theme')).toBeInTheDocument();
    expect(within(current).getByRole('button', { name: 'Customize' })).toBeInTheDocument();
    // Said once: one active theme, no second "Active" badge.
    expect(screen.getAllByText(/Active/)).toHaveLength(1);
    expect(within(current).queryByRole('button', { name: 'Activate' })).toBeNull();
    expect(within(current).getByRole('link', { name: /View store/ })).toHaveAttribute('href', 'http://localhost:3000/?store=alpha');
    expect(within(current).getByRole('img', { name: 'Default theme preview' })).toHaveAttribute('src', '/theme-previews/default.jpg');
  });

  it('Customize opens the editor on the active theme', async () => {
    mockLoad();
    const user = userEvent.setup();
    render(<ThemeLibraryPage />);
    await user.click(await screen.findByRole('button', { name: 'Customize' }));
    expect(push).toHaveBeenCalledWith('/dashboard/theme/editor');
    expect(api.patch).not.toHaveBeenCalled();
  });

  it('other themes offer Activate (not Customize); activating selects and publishes after confirming', async () => {
    mockLoad();
    api.patch.mockResolvedValue({ success: true, data: storeTheme() });
    api.post.mockResolvedValue({ success: true, data: storeTheme() });
    const user = userEvent.setup();
    render(<ThemeLibraryPage />);
    const library = (await screen.findByRole('heading', { name: 'Theme library' })).closest('section')!;
    expect(within(library).queryByRole('heading', { name: 'Default' })).toBeNull();
    expect(within(library).queryByRole('button', { name: 'Customize' })).toBeNull();
    const minimal = within(library).getByRole('heading', { name: 'Minimal' }).closest('li')!;

    await user.click(within(minimal).getByRole('button', { name: 'Activate' }));
    const dialog = screen.getByRole('dialog', { name: 'Activate Minimal?' });
    expect(dialog).toHaveTextContent('Minimal replaces Default on your store right away.');
    expect(api.patch).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: 'Activate' }));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/stores/store-1/theme/publish'));
    expect(api.patch).toHaveBeenCalledWith('/stores/store-1/theme', { themeId: 'theme-minimal' });
    expect(pushToast).toHaveBeenCalledWith('Minimal is now live on your store.', 'success');
  });

  it('cancelling Activate changes nothing', async () => {
    mockLoad();
    const user = userEvent.setup();
    render(<ThemeLibraryPage />);
    const minimal = (await screen.findByRole('heading', { name: 'Minimal' })).closest('li')!;
    await user.click(within(minimal).getByRole('button', { name: 'Activate' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(api.patch).not.toHaveBeenCalled();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('shows a real screenshot for every theme, and a drawn stand-in when there is none', async () => {
    mockLoad(storeTheme(), [...THEMES, item({ ...summary('theme-custom', 'Custom', 'custom'), previewImageUrl: 'https://cdn.example/custom.jpg' })]);
    render(<ThemeLibraryPage />);
    const library = (await screen.findByRole('heading', { name: 'Theme library' })).closest('section')!;
    expect(within(library).getByRole('img', { name: 'Minimal theme preview' })).toHaveAttribute('src', '/theme-previews/minimal.jpg');
    expect(within(library).getByRole('img', { name: 'ShopEase theme preview' })).toHaveAttribute('src', '/theme-previews/shopease.jpg');
    const custom = within(library).getByRole('img', { name: 'Custom theme preview' });
    expect(custom).toHaveAttribute('src', 'https://cdn.example/custom.jpg');
    fireEvent.error(custom);
    expect(within(library).queryByRole('img', { name: 'Custom theme preview' })).toBeNull();
  });

  it('a locked premium theme offers Preview (try in the editor) and Buy', async () => {
    mockLoad();
    const user = userEvent.setup();
    render(<ThemeLibraryPage />);
    const card = (await screen.findByRole('heading', { name: 'ShopEase' })).closest('li')!;
    expect(within(card).getByText('Premium · ৳999')).toBeInTheDocument();
    expect(within(card).queryByRole('button', { name: 'Activate' })).toBeNull();
    expect(within(card).getByRole('link', { name: 'Preview' })).toHaveAttribute('href', '/dashboard/theme/editor?try=theme-shopease');

    await user.click(within(card).getByRole('button', { name: 'Buy for ৳999' }));
    expect(await screen.findByRole('dialog', { name: 'Buy the ShopEase theme' })).toBeInTheDocument();
  });

  it('the live theme is active even when the editor has another theme selected', async () => {
    mockLoad(storeTheme({ theme: summary('theme-minimal', 'Minimal', 'minimal'), isLive: false }));
    api.patch.mockResolvedValue({ success: true, data: storeTheme() });
    const user = userEvent.setup();
    render(<ThemeLibraryPage />);
    const current = (await screen.findByRole('heading', { name: 'Default' })).closest('section')!;
    expect(within(current).getByText('Active theme')).toBeInTheDocument();
    // Customize puts the editor back on the active theme.
    await user.click(within(current).getByRole('button', { name: 'Customize' }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/stores/store-1/theme', { themeId: 'theme-default' }));
    expect(push).toHaveBeenCalledWith('/dashboard/theme/editor');
  });

  it('with nothing published, the default theme (what the store shows) is active', async () => {
    mockLoad(storeTheme({ theme: summary('theme-minimal', 'Minimal', 'minimal'), isLive: false, liveTheme: null }));
    render(<ThemeLibraryPage />);
    const current = (await screen.findByRole('heading', { name: 'Default' })).closest('section')!;
    expect(within(current).getByText('Active theme')).toBeInTheDocument();
    const minimal = screen.getByRole('heading', { name: 'Minimal' }).closest('li')!;
    expect(within(minimal).getByRole('button', { name: 'Activate' })).toBeInTheDocument();
  });

  it('read-only members can look but not switch or buy', async () => {
    canManage = false;
    mockLoad();
    render(<ThemeLibraryPage />);
    const library = (await screen.findByRole('heading', { name: 'Theme library' })).closest('section')!;
    expect(within(library).queryByRole('button', { name: 'Activate' })).toBeNull();
    expect(within(library).queryByRole('button', { name: /Buy for/ })).toBeNull();
  });
});
