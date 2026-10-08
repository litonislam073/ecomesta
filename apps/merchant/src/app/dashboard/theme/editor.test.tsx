import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { StoreTheme, ThemeListItem } from '@ecomesta/types';
import ThemePage from '@/app/dashboard/theme/page';


const pushToast = vi.fn();
let canManage = true;
const routerPush = vi.fn();
const routerReplace = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: routerPush, replace: routerReplace, refresh: vi.fn() }),
}));

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
  put: vi.fn(),
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
      put: (...args: unknown[]) => api.put(...args),
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
];

const TOKEN = 'a'.repeat(32);
const products = [
  { id: '11111111-1111-4111-8111-111111111111', name: 'Silk Saree', sku: 'SAREE', basePrice: '1500.00', compareAtPrice: null },
  { id: '22222222-2222-4222-8222-222222222222', name: 'Cotton Panjabi', sku: 'PANJ', basePrice: '750.00', compareAtPrice: '1000.00' },
];

function mockLoad(list: ThemeListItem[] = themes) {
  api.get.mockImplementation((path: string) => {
    if (path.endsWith('/themes')) return Promise.resolve({ success: true, data: { items: list } });
    if (path.includes('/products?')) return Promise.resolve({ success: true, data: { items: products } });
    if (path.includes('/categories?')) return Promise.resolve({ success: true, data: { items: [] } });
    if (path === '/billing/payment-accounts') {
      return Promise.resolve({ success: true, data: [{ method: 'BKASH', label: 'bKash', number: '01700000000', transferType: 'Send Money' }] });
    }
    return Promise.resolve({ success: true, data: storeTheme });
  });
  api.put.mockResolvedValue({ success: true, data: { token: TOKEN, expiresAt: '2026-10-08T12:00:00.000Z' } });
}

const frame = () => screen.getByTitle('Storefront preview') as HTMLIFrameElement;

function fromPreview(data: Record<string, unknown>) {
  act(() => {
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'ecomesta-theme-preview', ...data },
        origin: 'http://localhost:3000',
        source: frame().contentWindow,
      }),
    );
  });
}

describe('Theme editor (Shopify-style)', () => {
  beforeEach(() => {
    canManage = true;
    pushToast.mockReset();
    api.get.mockReset();
    api.post.mockReset();
    api.patch.mockReset();
    api.put.mockReset();
  });

  it('shows the real storefront with the unsaved draft and refreshes it while typing', async () => {
    mockLoad();
    const user = userEvent.setup();
    render(<ThemePage />);

    await waitFor(() => expect(frame()).toBeInTheDocument());
    expect(api.put).toHaveBeenCalledWith('/stores/store-1/theme/preview-session', {
      themeId: 'theme-default',
      configuration: expect.objectContaining({ hero: expect.objectContaining({ headline: 'Shop the new arrivals' }) }),
    });
    const src = new URL(frame().src);
    expect(src.origin).toBe('http://localhost:3000');
    expect(src.searchParams.get('store')).toBe('alpha');
    expect(src.searchParams.get('theme_preview')).toBe(TOKEN);

    const postMessage = vi.spyOn(frame().contentWindow!, 'postMessage');
    await user.click(screen.getByRole('button', { name: /^Hero banner/ }));
    const headline = screen.getByLabelText('Headline');
    await user.clear(headline);
    await user.type(headline, 'Eid Sale');

    await waitFor(() =>
      expect(api.put).toHaveBeenLastCalledWith('/stores/store-1/theme/preview-session', {
        themeId: 'theme-default',
        token: TOKEN,
        configuration: expect.objectContaining({ hero: expect.objectContaining({ headline: 'Eid Sale' }) }),
      }),
    );
    await waitFor(() =>
      expect(postMessage).toHaveBeenCalledWith({ type: 'ecomesta-theme-preview', action: 'refresh' }, 'http://localhost:3000'),
    );
    // Opening a section scrolls the preview to it.
    expect(postMessage).toHaveBeenCalledWith(
      { type: 'ecomesta-theme-preview', action: 'focus', section: 'hero' },
      'http://localhost:3000',
    );
    // Previewing never saves.
    expect(api.patch).not.toHaveBeenCalled();
  });

  it('a section clicked in the preview opens its settings; messages from elsewhere are ignored', async () => {
    mockLoad();
    render(<ThemePage />);
    await waitFor(() => expect(frame()).toBeInTheDocument());

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { type: 'ecomesta-theme-preview', action: 'select', section: 'footer' },
          origin: 'https://evil.example',
          source: frame().contentWindow,
        }),
      );
    });
    expect(screen.queryByRole('button', { name: 'Back to sections' })).toBeNull();

    fromPreview({ action: 'select', section: 'footer' });
    expect(screen.getByRole('button', { name: 'Back to sections' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Footer' })).toBeVisible();
  });

  it('follows pages opened inside the preview and switches page and size from the toolbar', async () => {
    mockLoad();
    const user = userEvent.setup();
    render(<ThemePage />);
    await waitFor(() => expect(frame()).toBeInTheDocument());

    fromPreview({ action: 'ready', path: '/products' });
    const [picker] = screen.getAllByLabelText('Preview page');
    expect(picker).toHaveValue('/products');

    await user.selectOptions(picker!, '/cart');
    await waitFor(() => expect(new URL(frame().src).pathname).toBe('/cart'));
    expect(new URL(frame().src).searchParams.get('theme_preview')).toBe(TOKEN);

    await user.click(screen.getAllByRole('button', { name: 'Mobile preview' })[0]!);
    expect(frame().parentElement).toHaveStyle({ width: '390px' });
    await user.click(screen.getAllByRole('button', { name: 'Desktop preview' })[0]!);
    expect(frame().parentElement).toHaveStyle({ width: '100%' });
  });

  it('hides, shows and reorders homepage sections; Save sends the new order', async () => {
    mockLoad();
    api.patch.mockResolvedValue({ success: true, data: storeTheme });
    const user = userEvent.setup();
    render(<ThemePage />);
    const sidebar = await screen.findByRole('complementary', { name: 'Theme settings' });

    await user.click(within(sidebar).getByRole('button', { name: 'Hide hero banner' }));
    expect(within(sidebar).getByRole('button', { name: /^Hero banner.*Hidden/ })).toBeInTheDocument();
    expect(screen.getByTestId('unsaved-indicator')).toBeInTheDocument();

    await user.click(within(sidebar).getByRole('button', { name: 'Add section' }));
    await user.click(screen.getByRole('menuitem', { name: /^Categories/ }));
    expect(screen.getByRole('heading', { name: 'Categories section' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Back to sections' }));
    expect(within(sidebar).getByRole('button', { name: 'Move Shop by category down' })).toBeDisabled();
    await user.click(within(sidebar).getByRole('button', { name: 'Move Shop by category up' }));
    await user.click(within(sidebar).getByRole('button', { name: 'Hide Picks' }));

    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(api.patch).toHaveBeenCalled());
    const sent = api.patch.mock.calls[0]![1] as { configuration: Record<string, any> };
    expect(sent.configuration.hero).toMatchObject({ enabled: false });
    expect(sent.configuration.homepage.sections).toEqual([
      { type: 'featured_categories', title: 'Shop by category', enabled: true },
      { type: 'featured_products', title: 'Picks', enabled: false },
    ]);
  });

  it('features chosen products instead of typing IDs', async () => {
    mockLoad();
    api.patch.mockResolvedValue({ success: true, data: storeTheme });
    const user = userEvent.setup();
    render(<ThemePage />);
    const sidebar = await screen.findByRole('complementary', { name: 'Theme settings' });

    await user.click(within(sidebar).getByRole('button', { name: /^Picks/ }));
    expect(screen.getByText(/newest products automatically/)).toBeInTheDocument();
    await user.click(await screen.findByRole('checkbox', { name: 'Cotton Panjabi' }));
    expect(screen.getByText(/1 chosen/)).toBeInTheDocument();
    const panel = within(screen.getByRole('heading', { name: 'Products section' }).closest('section')!);
    await user.clear(panel.getByLabelText('Heading'));
    await user.type(panel.getByLabelText('Heading'), 'Best sellers');

    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(api.patch).toHaveBeenCalled());
    const sent = api.patch.mock.calls[0]![1] as { configuration: Record<string, any> };
    expect(sent.configuration.homepage.featuredProducts).toEqual([products[1]!.id]);
    expect(sent.configuration.homepage.sections).toEqual([{ type: 'featured_products', title: 'Best sellers', enabled: true }]);
  });

  it('applies a color preset in one click', async () => {
    mockLoad();
    const user = userEvent.setup();
    render(<ThemePage />);
    const sidebar = await screen.findByRole('complementary', { name: 'Theme settings' });
    await user.click(within(sidebar).getByRole('tab', { name: 'Theme settings' }));
    await user.click(within(sidebar).getByRole('button', { name: 'Colors' }));

    const sunset = screen.getByRole('button', { name: 'Sunset color preset' });
    expect(sunset).toHaveAttribute('aria-pressed', 'false');
    await user.click(sunset);
    expect(sunset).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('Primary color')).toHaveValue('#f26522');
    expect(screen.getByLabelText('Surface color')).toHaveValue('#fbf3ec');
  });

  it('falls back to the simple preview when the live preview cannot start', async () => {
    mockLoad();
    api.put.mockRejectedValue(new Error('store not active'));
    render(<ThemePage />);
    expect(await screen.findByRole('region', { name: 'Storefront preview' })).toHaveTextContent('Shop the new arrivals');
    expect(screen.getByText(/live storefront preview is not available/i)).toBeInTheDocument();
    expect(screen.queryByTitle('Storefront preview')).toBeNull();
  });

  it('read-only members get no live preview session and no editing', async () => {
    canManage = false;
    mockLoad();
    render(<ThemePage />);
    expect(await screen.findByText(/read-only access/)).toBeInTheDocument();
    expect(api.put).not.toHaveBeenCalled();
    expect(screen.getByRole('region', { name: 'Storefront preview' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hide hero banner' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Publish' })).toBeNull();
  });
  it('reorders sections by drag and drop', async () => {
    mockLoad();
    api.patch.mockResolvedValue({ success: true, data: storeTheme });
    const user = userEvent.setup();
    render(<ThemePage />);
    const sidebar = await screen.findByRole('complementary', { name: 'Theme settings' });
    await user.click(within(sidebar).getByRole('button', { name: 'Add section' }));
    await user.click(screen.getByRole('menuitem', { name: /^Categories/ }));
    await user.click(screen.getByRole('button', { name: 'Back to sections' }));

    const row = (key: string) => sidebar.querySelector(`[data-section-row="${key}"]`)!;
    expect(row('featured_products').compareDocumentPosition(row('featured_categories')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const dataTransfer = { setData: vi.fn(), effectAllowed: '', dropEffect: '' };
    fireEvent.dragStart(row('featured_categories'), { dataTransfer });
    fireEvent.dragOver(row('featured_products'), { dataTransfer, clientY: 0 });
    fireEvent.drop(row('featured_products'), { dataTransfer });
    fireEvent.dragEnd(row('featured_categories'), { dataTransfer });
    expect(row('featured_categories').compareDocumentPosition(row('featured_products')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(api.patch).toHaveBeenCalled());
    const sent = api.patch.mock.calls[0]![1] as { configuration: Record<string, any> };
    expect(sent.configuration.homepage.sections.map((section: { type: string }) => section.type)).toEqual([
      'featured_categories',
      'featured_products',
    ]);
  });

  it('adds, edits and removes a rich text section; the preview gets it too', async () => {
    mockLoad();
    // Like the API: the saved draft comes back merged.
    api.patch.mockImplementation((_path: string, body: { configuration: object }) =>
      Promise.resolve({ success: true, data: { ...storeTheme, configuration: { ...storeTheme.configuration, ...body.configuration } } }),
    );
    const user = userEvent.setup();
    render(<ThemePage />);
    const sidebar = await screen.findByRole('complementary', { name: 'Theme settings' });

    await user.click(within(sidebar).getByRole('button', { name: 'Add section' }));
    await user.click(screen.getByRole('menuitem', { name: /^Rich text/ }));
    const card = within(screen.getByRole('heading', { name: 'Rich text' }).closest('section')!);
    await user.clear(card.getByLabelText('Heading'));
    await user.type(card.getByLabelText('Heading'), 'Our story');
    await user.type(card.getByLabelText(/^Text/), 'Made in Dhaka.{Enter}Since 2020.');
    await user.type(card.getByLabelText('Button label'), 'Shop now');
    await user.type(card.getByLabelText(/^Button link/), '/products');
    // The panel is named after its heading, like the row.
    expect(screen.getByText('Our story', { selector: 'p' })).toBeInTheDocument();

    await waitFor(() =>
      expect(api.put).toHaveBeenLastCalledWith(
        '/stores/store-1/theme/preview-session',
        expect.objectContaining({
          configuration: expect.objectContaining({
            homepage: expect.objectContaining({
              sections: expect.arrayContaining([expect.objectContaining({ type: 'rich_text', title: 'Our story' })]),
            }),
          }),
        }),
      ),
    );

    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(api.patch).toHaveBeenCalled());
    const sent = api.patch.mock.calls[0]![1] as { configuration: Record<string, any> };
    const added = sent.configuration.homepage.sections[1];
    expect(added).toEqual({
      type: 'rich_text',
      id: expect.stringMatching(/^text-[a-z0-9]+$/),
      enabled: true,
      title: 'Our story',
      text: 'Made in Dhaka.\nSince 2020.',
      buttonLabel: 'Shop now',
      buttonHref: '/products',
    });

    await user.click(screen.getByRole('button', { name: 'Remove section' }));
    expect(screen.getByRole('tab', { name: 'Sections' })).toBeInTheDocument();
    expect(within(sidebar).queryByRole('button', { name: /^Our story/ })).toBeNull();
  });

  it('adds an image banner with an image field', async () => {
    mockLoad();
    const user = userEvent.setup();
    render(<ThemePage />);
    const sidebar = await screen.findByRole('complementary', { name: 'Theme settings' });
    await user.click(within(sidebar).getByRole('button', { name: 'Add section' }));
    await user.click(screen.getByRole('menuitem', { name: /^Image banner/ }));
    const card = within(screen.getByRole('heading', { name: 'Image banner' }).closest('section')!);
    expect(card.getByRole('group', { name: 'Image' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Back to sections' }));
    expect(within(sidebar).getByRole('button', { name: /^Image banner/ })).toBeInTheDocument();
    expect(within(sidebar).getByRole('button', { name: 'Move Image banner down' })).toBeDisabled();
  });

  it('tries a locked premium theme in the preview before buying it', async () => {
    const shopease: ThemeListItem = {
      id: 'theme-shopease',
      name: 'ShopEase',
      slug: 'shopease',
      version: '1.0.0',
      previewImageUrl: null,
      description: 'Premium storefront.',
      selected: false,
      live: false,
      premium: true,
      priceBdt: '999.00',
      access: 'locked',
      purchase: null,
    };
    mockLoad([...themes, shopease]);
    const user = userEvent.setup();
    render(<ThemePage />);
    const sidebar = await screen.findByRole('complementary', { name: 'Theme settings' });
    await waitFor(() => expect(api.put).toHaveBeenCalled());
    await user.click(within(sidebar).getByRole('tab', { name: 'Theme settings' }));
    await user.click(within(sidebar).getByRole('button', { name: /^Theme: / }));
    await user.click(screen.getByRole('button', { name: 'Preview' }));

    // The theme as it ships: no draft configuration is sent.
    await waitFor(() =>
      expect(api.put).toHaveBeenLastCalledWith('/stores/store-1/theme/preview-session', { themeId: 'theme-shopease', token: TOKEN }),
    );
    expect(screen.getByRole('region', { name: 'Previewing ShopEase' })).toHaveTextContent(/nothing on\s+your live store changes/i);
    expect(screen.queryByRole('button', { name: 'Publish' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Save draft' })).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Buy for ৳999' }).length).toBeGreaterThan(0);

    await user.click(screen.getAllByRole('button', { name: 'Buy for ৳999' })[0]!);
    expect(await screen.findByRole('dialog', { name: 'Buy the ShopEase theme' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close payment' }));

    await user.click(screen.getByRole('button', { name: 'Exit preview' }));
    await waitFor(() =>
      expect(api.put).toHaveBeenLastCalledWith(
        '/stores/store-1/theme/preview-session',
        expect.objectContaining({ themeId: 'theme-default', configuration: expect.any(Object) }),
      ),
    );
    expect(screen.getByRole('button', { name: 'Publish' })).toBeInTheDocument();
  });

  it('edits ShopEase’s deal of the day like any section', async () => {
    const shopeaseTheme: StoreTheme = {
      ...storeTheme,
      theme: { ...storeTheme.theme, id: 'theme-shopease', name: 'ShopEase', slug: 'shopease' },
      configuration: {
        ...storeTheme.configuration,
        homepage: { sections: [{ type: 'featured_categories', enabled: true }, { type: 'featured_products', title: 'New arrivals', enabled: true }] },
      },
    };
    mockLoad();
    const base = api.get.getMockImplementation()!;
    api.get.mockImplementation((path: string) =>
      path.endsWith('/theme') ? Promise.resolve({ success: true, data: shopeaseTheme }) : base(path),
    );
    api.patch.mockImplementation((_path: string, body: { configuration: object }) =>
      Promise.resolve({ success: true, data: { ...shopeaseTheme, configuration: { ...shopeaseTheme.configuration, ...body.configuration } } }),
    );
    const user = userEvent.setup();
    render(<ThemePage />);
    const sidebar = await screen.findByRole('complementary', { name: 'Theme settings' });

    // Listed where the store shows it (above the products), without marking the draft changed.
    const rows = () => Array.from(sidebar.querySelectorAll('[data-section-row]')).map((el) => el.getAttribute('data-section-row'));
    expect(rows()).toEqual(['featured_categories', 'deal_of_day', 'featured_products']);
    expect(screen.queryByTestId('unsaved-indicator')).toBeNull();

    await user.click(within(sidebar).getByRole('button', { name: /^Deal of the day/ }));
    const card = within(screen.getByRole('heading', { name: 'Deal of the day' }).closest('section')!);
    expect(card.getByLabelText('Heading')).toHaveValue("Grab it before it's gone!");
    await user.clear(card.getByLabelText('Heading'));
    await user.type(card.getByLabelText('Heading'), 'Flash sale');
    await user.click(card.getByLabelText('Show countdown to midnight'));
    // Discounted products come first, with their discount.
    const radios = await card.findAllByRole('radio');
    expect(radios.map((r) => r.closest('label')!.textContent)).toEqual([
      'Automatic — the biggest discount',
      'Cotton Panjabi25% off',
      'Silk Saree',
    ]);
    await user.click(card.getByRole('radio', { name: /Silk Saree/ }));

    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(api.patch).toHaveBeenCalled());
    const sent = api.patch.mock.calls[0]![1] as { configuration: Record<string, any> };
    expect(sent.configuration.homepage.sections[1]).toEqual({
      type: 'deal_of_day',
      title: 'Flash sale',
      text: 'Today only — the offer ends at midnight.',
      buttonLabel: 'Shop the deal',
      showCountdown: false,
      enabled: true,
      productId: products[0]!.id,
    });

    // Back to automatic.
    await user.click(card.getByRole('radio', { name: /Automatic/ }));
    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledTimes(2));
    const second = api.patch.mock.calls[1]![1] as { configuration: Record<string, any> };
    expect(second.configuration.homepage.sections[1].productId).toBeUndefined();
  });

  it('sets ShopEase’s hero offer badge: automatic, custom text or hidden', async () => {
    const shopeaseTheme: StoreTheme = {
      ...storeTheme,
      theme: { ...storeTheme.theme, id: 'theme-shopease', name: 'ShopEase', slug: 'shopease' },
    };
    mockLoad();
    const base = api.get.getMockImplementation()!;
    api.get.mockImplementation((path: string) =>
      path.endsWith('/theme') ? Promise.resolve({ success: true, data: shopeaseTheme }) : base(path),
    );
    api.patch.mockResolvedValue({ success: true, data: shopeaseTheme });
    const user = userEvent.setup();
    render(<ThemePage />);
    const sidebar = await screen.findByRole('complementary', { name: 'Theme settings' });
    await user.click(within(sidebar).getByRole('button', { name: /^Hero banner/ }));

    const badge = within(screen.getByRole('group', { name: 'Offer badge' }));
    expect(badge.getByRole('radio', { name: /Automatic/ })).toBeChecked();
    expect(badge.queryByLabelText('Big text')).toBeNull();
    await user.click(badge.getByRole('radio', { name: /Custom text/ }));
    await user.type(badge.getByLabelText('Top line'), 'EID');
    await user.type(badge.getByLabelText('Big text'), '50% OFF EVERYTHING');
    await user.type(badge.getByLabelText('Bottom line'), 'TODAY');
    expect(badge.getByLabelText('Big text')).toHaveValue('50% OFF EVER');

    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(api.patch).toHaveBeenCalled());
    const sent = api.patch.mock.calls[0]![1] as { configuration: Record<string, any> };
    expect(sent.configuration.hero).toEqual({ badgeMode: 'custom', badgeTop: 'EID', badgeMain: '50% OFF EVER', badgeBottom: 'TODAY' });
  });

  it('other themes have no offer badge setting', async () => {
    mockLoad();
    const user = userEvent.setup();
    render(<ThemePage />);
    const sidebar = await screen.findByRole('complementary', { name: 'Theme settings' });
    await user.click(within(sidebar).getByRole('button', { name: /^Hero banner/ }));
    expect(screen.queryByRole('group', { name: 'Offer badge' })).toBeNull();
  });
});
