import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { StoreTheme, ThemeListItem } from '@ecomesta/types';
import ThemePage from '@/app/dashboard/theme/editor/page';
import { ApiError } from '@/lib/api-client';

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

/** Theme settings tab → Theme: the list of themes (switch or buy). */
async function openThemeList(user = userEvent.setup()) {
  await user.click(await screen.findByRole('tab', { name: 'Theme settings' }));
  await user.click(screen.getByRole('button', { name: /^Theme: / }));
}

describe('Theme customizer', () => {
  beforeEach(() => {
    canManage = true;
    pushToast.mockReset();
    api.get.mockReset();
    api.post.mockReset();
    api.patch.mockReset();
  });

  it('opens as a Shopify-style editor: sections list, settings panels and a preview', async () => {
    mockLoad();
    const user = userEvent.setup();
    render(<ThemePage />);

    expect(await screen.findByRole('heading', { name: /^theme$/i })).toBeInTheDocument();
    // The page heading is visible while LoadingState is up — wait for the editor.
    const sidebar = await screen.findByRole('complementary', { name: 'Theme settings' });
    expect(within(sidebar).getByRole('tab', { name: 'Sections', selected: true })).toBeInTheDocument();
    for (const name of ['Announcement bar', 'Header', 'Hero banner', 'Picks', 'Footer']) {
      expect(within(sidebar).getByRole('button', { name: new RegExp(`^${name}`) })).toBeInTheDocument();
    }
    // Only the products block is listed in the draft: categories can be added back.
    await user.click(within(sidebar).getByRole('button', { name: 'Add section' }));
    expect(screen.getByRole('menuitem', { name: /^Categories/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /^Rich text/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /^Image banner/ })).toBeInTheDocument();
    await user.keyboard('{Escape}');

    // A section opens its settings; Back returns to the list.
    await user.click(within(sidebar).getByRole('button', { name: /^Hero banner/ }));
    expect(screen.getByRole('heading', { name: 'Hero' })).toBeInTheDocument();
    expect(screen.getByLabelText('Headline')).toHaveValue('Shop the new arrivals');
    await user.click(screen.getByRole('button', { name: 'Back to sections' }));

    await user.click(within(sidebar).getByRole('tab', { name: 'Theme settings' }));
    for (const name of ['Logo & brand', 'Colors', 'Typography', 'SEO']) {
      expect(within(sidebar).getByRole('button', { name })).toBeInTheDocument();
    }
    await user.click(within(sidebar).getByRole('button', { name: 'Logo & brand' }));
    expect(screen.getByRole('heading', { name: 'Logo & brand' })).toBeInTheDocument();
    expect(screen.getByLabelText('Brand name')).toHaveValue('Alpha Goods');

    // No live storefront preview in tests: the simple preview renders the draft.
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

  it('blocks saving an invalid color instead of dropping it (TE-05)', async () => {
    mockLoad();
    api.patch.mockResolvedValue({ success: true, data: storeTheme });
    const user = userEvent.setup();
    render(<ThemePage />);

    const primary = await screen.findByLabelText('Primary color');
    await user.clear(primary);
    await user.type(primary, 'not-a-color');
    expect(screen.getByText(/enter a hex color/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(api.patch).not.toHaveBeenCalled();
    expect(pushToast).not.toHaveBeenCalledWith('Draft saved', 'success');
    expect(primary).toHaveValue('not-a-color');
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

    await openThemeList(user);
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

// TE-01: the menu and social-link textareas must behave like plain text
// editors while typing; parsing must never rewrite what the merchant typed.
describe('Theme customizer: menu and social link editing (TE-01)', () => {
  const withNav = (
    header: StoreTheme['configuration']['header'],
    footer: StoreTheme['configuration']['footer'],
  ): StoreTheme => ({
    ...storeTheme,
    configuration: { ...storeTheme.configuration, header, footer },
  });

  function mockLoadWith(theme: StoreTheme) {
    api.get.mockImplementation((path: string) =>
      path.endsWith('/themes')
        ? Promise.resolve({ success: true, data: { items: themes, meta: { total: 2 } } })
        : Promise.resolve({ success: true, data: theme }),
    );
    api.patch.mockResolvedValue({ success: true, data: theme });
  }

  const headerMenu = () => screen.getByLabelText(/^Header menu/) as HTMLTextAreaElement;
  const footerMenu = () => screen.getByLabelText(/^Footer menu/) as HTMLTextAreaElement;
  const socialLinks = () => screen.getByLabelText(/^Social links/) as HTMLTextAreaElement;

  async function savedConfiguration(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledTimes(1));
    return (api.patch.mock.calls[0] as [string, { configuration: StoreTheme['configuration'] }])[1]
      .configuration;
  }

  beforeEach(() => {
    canManage = true;
    pushToast.mockReset();
    api.get.mockReset();
    api.post.mockReset();
    api.patch.mockReset();
  });

  it('loads an existing header menu into the editor', async () => {
    mockLoadWith(withNav({ menuItems: [{ label: 'Shop', href: '/products' }, { label: 'Sale', href: '/sale' }] }, {}));
    render(<ThemePage />);
    await screen.findByLabelText('Brand name');
    expect(headerMenu().value).toBe('Shop | /products\nSale | /sale');
    expect(footerMenu().value).toBe('');
  });

  it('keeps the first typed character as typed', async () => {
    mockLoadWith(withNav({ menuItems: [] }, {}));
    const user = userEvent.setup();
    render(<ThemePage />);
    await screen.findByLabelText('Brand name');
    await user.type(headerMenu(), 'S');
    expect(headerMenu().value).toBe('S');
  });

  it('types multiple header menu lines exactly, with Enter creating a new line', async () => {
    mockLoadWith(withNav({ menuItems: [] }, {}));
    const user = userEvent.setup();
    render(<ThemePage />);
    await screen.findByLabelText('Brand name');

    await user.type(headerMenu(), 'Shop | /products{Enter}');
    expect(headerMenu().value).toBe('Shop | /products\n');
    await user.type(headerMenu(), 'Sale | /sale');
    expect(headerMenu().value).toBe('Shop | /products\nSale | /sale');
    // The caret stays at the end of what was typed.
    expect(headerMenu().selectionStart).toBe(headerMenu().value.length);

    const saved = await savedConfiguration(user);
    expect(saved.header?.menuItems).toEqual([
      { label: 'Shop', href: '/products' },
      { label: 'Sale', href: '/sale' },
    ]);
  });

  it('edits one line in place without touching the others', async () => {
    mockLoadWith(withNav({ menuItems: [{ label: 'Shop', href: '/products' }, { label: 'Sale', href: '/sale' }] }, {}));
    const user = userEvent.setup();
    render(<ThemePage />);
    await screen.findByLabelText('Brand name');

    // Insert " all" after "Shop" on the first line (caret in the middle of the text).
    await user.type(headerMenu(), ' all', { initialSelectionStart: 4, initialSelectionEnd: 4 });
    expect(headerMenu().value).toBe('Shop all | /products\nSale | /sale');
    expect(headerMenu().selectionStart).toBe(8);

    const saved = await savedConfiguration(user);
    expect(saved.header?.menuItems).toEqual([
      { label: 'Shop all', href: '/products' },
      { label: 'Sale', href: '/sale' },
    ]);
  });

  it('types footer menu lines exactly and saves them as items', async () => {
    mockLoadWith(withNav({}, { menuItems: [] }));
    const user = userEvent.setup();
    render(<ThemePage />);
    await screen.findByLabelText('Brand name');

    await user.type(footerMenu(), 'About | /about{Enter}Contact | /contact');
    expect(footerMenu().value).toBe('About | /about\nContact | /contact');
    const saved = await savedConfiguration(user);
    expect(saved.footer?.menuItems).toEqual([
      { label: 'About', href: '/about' },
      { label: 'Contact', href: '/contact' },
    ]);
  });

  it('keeps spaces and long URLs intact', async () => {
    const longUrl = `https://example.com/${'a'.repeat(300)}`;
    mockLoadWith(withNav({ menuItems: [] }, {}));
    const user = userEvent.setup();
    render(<ThemePage />);
    await screen.findByLabelText('Brand name');

    await user.click(headerMenu());
    await user.paste(`New arrivals  |  ${longUrl}`);
    expect(headerMenu().value).toBe(`New arrivals  |  ${longUrl}`);
    const saved = await savedConfiguration(user);
    expect(saved.header?.menuItems).toEqual([{ label: 'New arrivals', href: longUrl }]);
  });

  it('sends an emptied menu as an empty list', async () => {
    mockLoadWith(withNav({ menuItems: [{ label: 'Shop', href: '/products' }] }, {}));
    const user = userEvent.setup();
    render(<ThemePage />);
    await screen.findByLabelText('Brand name');

    await user.clear(headerMenu());
    expect(headerMenu().value).toBe('');
    const saved = await savedConfiguration(user);
    expect(saved.header?.menuItems).toEqual([]);
  });

  it('still sends unsafe menu URLs to the server, which rejects the save', async () => {
    mockLoadWith(withNav({ menuItems: [] }, {}));
    api.patch.mockRejectedValue(
      new ApiError(400, 'BAD_REQUEST', 'configuration.header.menuItems[0].href must use the http or https protocol'),
    );
    const user = userEvent.setup();
    render(<ThemePage />);
    await screen.findByLabelText('Brand name');

    await user.type(headerMenu(), 'Bad | javascript:alert(1)');
    expect(headerMenu().value).toBe('Bad | javascript:alert(1)');
    const saved = await savedConfiguration(user);
    expect(saved.header?.menuItems).toEqual([{ label: 'Bad', href: 'javascript:alert(1)' }]);
    await waitFor(() =>
      expect(pushToast).toHaveBeenCalledWith(expect.stringMatching(/must use the http or https protocol/), 'error'),
    );
    expect(pushToast).not.toHaveBeenCalledWith('Draft saved', 'success');
    // The typed text is kept so the merchant can correct it.
    expect(headerMenu().value).toBe('Bad | javascript:alert(1)');
  });

  it('types social links character by character without losing incomplete lines', async () => {
    mockLoadWith(withNav({}, { socialLinks: [] }));
    const user = userEvent.setup();
    render(<ThemePage />);
    await screen.findByLabelText('Brand name');

    await user.type(socialLinks(), 'fa');
    expect(socialLinks().value).toBe('fa');
    await user.type(socialLinks(), 'cebook | https://facebook.com/example');
    expect(socialLinks().value).toBe('facebook | https://facebook.com/example');
    await user.type(socialLinks(), '{Enter}instagram | https://instagram.com/example');
    expect(socialLinks().value).toBe(
      'facebook | https://facebook.com/example\ninstagram | https://instagram.com/example',
    );

    const saved = await savedConfiguration(user);
    expect(saved.footer?.socialLinks).toEqual([
      { network: 'facebook', url: 'https://facebook.com/example' },
      { network: 'instagram', url: 'https://instagram.com/example' },
    ]);
  });

  it('reloads existing social links into the editor', async () => {
    mockLoadWith(
      withNav({}, {
        socialLinks: [
          { network: 'facebook', url: 'https://facebook.com/example' },
          { network: 'x', url: 'https://x.com/example' },
        ],
      }),
    );
    render(<ThemePage />);
    await screen.findByLabelText('Brand name');
    expect(socialLinks().value).toBe('facebook | https://facebook.com/example\nx | https://x.com/example');
  });

  it('still sends unsafe social URLs to the server, which rejects the save', async () => {
    mockLoadWith(withNav({}, { socialLinks: [] }));
    api.patch.mockRejectedValue(
      new ApiError(400, 'BAD_REQUEST', 'configuration.footer.socialLinks[0].url must use the http or https protocol'),
    );
    const user = userEvent.setup();
    render(<ThemePage />);
    await screen.findByLabelText('Brand name');

    await user.type(socialLinks(), 'facebook | javascript:alert(1)');
    const saved = await savedConfiguration(user);
    expect(saved.footer?.socialLinks).toEqual([{ network: 'facebook', url: 'javascript:alert(1)' }]);
    await waitFor(() =>
      expect(pushToast).toHaveBeenCalledWith(expect.stringMatching(/must use the http or https protocol/), 'error'),
    );
    expect(socialLinks().value).toBe('facebook | javascript:alert(1)');
  });
});

// TE-02: clearing an optional URL must remove it instead of silently keeping
// the previously saved value.
describe('Theme customizer: clearing optional URLs (TE-02)', () => {
  const withUrls: StoreTheme = {
    ...storeTheme,
    configuration: {
      ...storeTheme.configuration,
      branding: {
        ...storeTheme.configuration.branding,
        logoUrl: 'https://cdn.example.com/logo.png',
        faviconUrl: 'https://cdn.example.com/favicon.ico',
      },
      announcement: { ...storeTheme.configuration.announcement, href: '/sale' },
      hero: {
        ...storeTheme.configuration.hero,
        ctaHref: '/products',
        imageUrl: 'https://cdn.example.com/hero.jpg',
      },
    },
  };

  function mockLoadWith(theme: StoreTheme, saved: StoreTheme = theme) {
    api.get.mockImplementation((path: string) =>
      path.endsWith('/themes')
        ? Promise.resolve({ success: true, data: { items: themes, meta: { total: 2 } } })
        : Promise.resolve({ success: true, data: theme }),
    );
    api.patch.mockResolvedValue({ success: true, data: saved });
  }

  async function save(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledTimes(1));
    return (api.patch.mock.calls[0] as [string, { configuration: StoreTheme['configuration'] }])[1]
      .configuration;
  }

  beforeEach(() => {
    canManage = true;
    pushToast.mockReset();
    api.get.mockReset();
    api.post.mockReset();
    api.patch.mockReset();
  });

  const FIELDS: Array<[string, (c: StoreTheme['configuration']) => unknown]> = [
    ['Logo URL', (c) => c.branding?.logoUrl],
    ['Favicon URL', (c) => c.branding?.faviconUrl],
    ['Announcement link', (c) => c.announcement?.href],
    ['CTA link', (c) => c.hero?.ctaHref],
    ['Background image URL', (c) => c.hero?.imageUrl],
  ];

  it.each(FIELDS)('sends a cleared %s as an empty value so the server removes it', async (label, read) => {
    mockLoadWith(withUrls);
    const user = userEvent.setup();
    render(<ThemePage />);
    const input = await screen.findByLabelText(new RegExp(`^${label}`));
    expect(input).not.toHaveValue('');

    await user.clear(input);
    expect(input).toHaveValue('');
    const sent = await save(user);
    expect(read(sent)).toBe('');
    await waitFor(() => expect(pushToast).toHaveBeenCalledWith('Draft saved', 'success'));
  });

  it('sends a whitespace-only optional URL as an empty value', async () => {
    mockLoadWith(withUrls);
    const user = userEvent.setup();
    render(<ThemePage />);
    const input = await screen.findByLabelText(/^Logo URL/);
    await user.clear(input);
    await user.type(input, '   ');
    const sent = await save(user);
    expect(sent.branding?.logoUrl).toBe('');
  });

  it('clears only the edited URL; untouched siblings are not re-sent (the server keeps them)', async () => {
    mockLoadWith(withUrls);
    const user = userEvent.setup();
    render(<ThemePage />);
    await user.clear(await screen.findByLabelText(/^CTA link/));
    const sent = await save(user);
    expect(sent).toEqual({ hero: { ctaHref: '' } });
  });

  it('does not send never-set optional URLs', async () => {
    mockLoadWith(storeTheme);
    const user = userEvent.setup();
    render(<ThemePage />);
    await screen.findByLabelText('Brand name');
    const sent = await save(user);
    // Nothing was edited, so nothing is sent: in particular no empty or
    // placeholder value for logo, favicon, hero image or announcement link.
    expect(sent).toEqual({});
  });

  it('shows the field empty after the save response removes the URL', async () => {
    const cleared: StoreTheme = {
      ...withUrls,
      configuration: {
        ...withUrls.configuration,
        branding: { ...withUrls.configuration.branding, logoUrl: undefined },
      },
    };
    mockLoadWith(withUrls, cleared);
    const user = userEvent.setup();
    render(<ThemePage />);
    await user.clear(await screen.findByLabelText(/^Logo URL/));
    await save(user);
    await waitFor(() => expect(screen.getByLabelText(/^Logo URL/)).toHaveValue(''));
    expect(screen.getByLabelText(/^Favicon URL/)).toHaveValue('https://cdn.example.com/favicon.ico');
  });

  it('reports a rejected save as an error, not "Draft saved"', async () => {
    mockLoadWith(withUrls);
    api.patch.mockRejectedValue(
      new ApiError(400, 'BAD_REQUEST', 'configuration.branding.logoUrl must use the http or https protocol'),
    );
    const user = userEvent.setup();
    render(<ThemePage />);
    const input = await screen.findByLabelText(/^Logo URL/);
    await user.clear(input);
    await user.type(input, 'javascript:alert(1)');
    await save(user);
    await waitFor(() =>
      expect(pushToast).toHaveBeenCalledWith(expect.stringMatching(/must use the http or https protocol/), 'error'),
    );
    expect(pushToast).not.toHaveBeenCalledWith('Draft saved', 'success');
  });
});

// TE-03: a save sends only what changed since the last load, so two tabs (or
// two managers) editing different fields cannot overwrite each other.
describe('Theme customizer: saving only changed fields (TE-03)', () => {
  beforeEach(() => {
    canManage = true;
    pushToast.mockReset();
    api.get.mockReset();
    api.post.mockReset();
    api.patch.mockReset();
  });

  async function saved(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledTimes(1));
    return (api.patch.mock.calls[0] as [string, { configuration: StoreTheme['configuration'] }])[1].configuration;
  }

  it('sends only the edited field, not the rest of the loaded draft', async () => {
    mockLoad();
    api.patch.mockResolvedValue({ success: true, data: storeTheme });
    const user = userEvent.setup();
    render(<ThemePage />);
    const headline = await screen.findByLabelText('Headline');
    await user.clear(headline);
    await user.type(headline, 'Tab A headline');
    expect(await saved(user)).toEqual({ hero: { headline: 'Tab A headline' } });
  });

  it('sends a changed list whole and leaves unchanged lists out', async () => {
    mockLoad();
    api.patch.mockResolvedValue({ success: true, data: storeTheme });
    const user = userEvent.setup();
    render(<ThemePage />);
    await screen.findByLabelText('Brand name');
    await user.type(screen.getByLabelText(/^Footer menu/), 'About | /about');
    expect(await saved(user)).toEqual({ footer: { menuItems: [{ label: 'About', href: '/about' }] } });
  });

  it('diffs against the latest server state after a save', async () => {
    mockLoad();
    const afterFirst: StoreTheme = {
      ...storeTheme,
      configuration: {
        ...storeTheme.configuration,
        hero: { ...storeTheme.configuration.hero, headline: 'First' },
        // Another tab changed the announcement in the meantime.
        announcement: { ...storeTheme.configuration.announcement, text: 'From tab B' },
      },
    };
    api.patch.mockResolvedValueOnce({ success: true, data: afterFirst }).mockResolvedValueOnce({ success: true, data: afterFirst });
    const user = userEvent.setup();
    render(<ThemePage />);
    const headline = await screen.findByLabelText('Headline');
    await user.clear(headline);
    await user.type(headline, 'First');
    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(screen.getByLabelText('Announcement text')).toHaveValue('From tab B'));

    await user.type(screen.getByLabelText('Tagline'), 'Second');
    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledTimes(2));
    const second = (api.patch.mock.calls[1] as [string, { configuration: StoreTheme['configuration'] }])[1].configuration;
    expect(second).toEqual({ branding: { tagline: 'Second' } });
  });
});

// TE-04: unsaved edits are tracked against the last saved draft and protected
// from reloads, in-app navigation, theme switches, reset, store switch and
// log out.
describe('Theme customizer: unsaved changes (TE-04)', () => {
  beforeEach(() => {
    canManage = true;
    pushToast.mockReset();
    routerPush.mockReset();
    routerReplace.mockReset();
    api.get.mockReset();
    api.post.mockReset();
    api.patch.mockReset();
  });

  const unsaved = () => screen.queryByTestId('unsaved-indicator');
  const beforeUnloadBlocked = () => {
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  };
  function internalLink(href = '/dashboard/orders') {
    const a = document.createElement('a');
    a.href = href;
    a.textContent = 'Orders';
    document.body.appendChild(a);
    return a;
  }
  async function editHeadline(user: ReturnType<typeof userEvent.setup>, value: string) {
    const headline = await screen.findByLabelText('Headline');
    await user.clear(headline);
    if (value) await user.type(headline, value);
    return headline;
  }

  it('starts clean after load: no indicator and no beforeunload block', async () => {
    mockLoad();
    render(<ThemePage />);
    await screen.findByLabelText('Brand name');
    expect(unsaved()).toBeNull();
    expect(beforeUnloadBlocked()).toBe(false);
  });

  it('marks edits unsaved, and clean again when changed back', async () => {
    mockLoad();
    const user = userEvent.setup();
    render(<ThemePage />);
    await editHeadline(user, 'Something new');
    expect(unsaved()).toHaveTextContent('Unsaved changes');
    expect(beforeUnloadBlocked()).toBe(true);

    await editHeadline(user, 'Shop the new arrivals');
    expect(unsaved()).toBeNull();
    expect(beforeUnloadBlocked()).toBe(false);
  });

  it('treats a cleared-but-never-set optional URL as clean', async () => {
    mockLoad();
    const user = userEvent.setup();
    render(<ThemePage />);
    const logo = await screen.findByLabelText(/^Logo URL/);
    await user.type(logo, 'x');
    expect(unsaved()).not.toBeNull();
    await user.clear(logo);
    expect(unsaved()).toBeNull();
  });

  it('clears the unsaved state after a successful save and uses the response as the baseline', async () => {
    mockLoad();
    const saved: StoreTheme = {
      ...storeTheme,
      configuration: {
        ...storeTheme.configuration,
        hero: { ...storeTheme.configuration.hero, headline: 'Saved headline' },
        // Merged in from another tab.
        announcement: { ...storeTheme.configuration.announcement, text: 'From another tab' },
      },
    };
    api.patch.mockResolvedValue({ success: true, data: saved });
    const user = userEvent.setup();
    render(<ThemePage />);
    await editHeadline(user, 'Saved headline');
    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(pushToast).toHaveBeenCalledWith('Draft saved', 'success'));
    expect(unsaved()).toBeNull();
    expect(screen.getByLabelText('Announcement text')).toHaveValue('From another tab');
    expect(screen.getByLabelText('Headline')).toHaveValue('Saved headline');
    expect(beforeUnloadBlocked()).toBe(false);
  });

  it('keeps edits and the unsaved state when saving fails', async () => {
    mockLoad();
    api.patch.mockRejectedValue(new ApiError(500, 'INTERNAL', 'Server unavailable'));
    const user = userEvent.setup();
    render(<ThemePage />);
    await editHeadline(user, 'Not saved yet');
    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(pushToast).toHaveBeenCalledWith(expect.any(String), 'error'));
    expect(pushToast).not.toHaveBeenCalledWith('Draft saved', 'success');
    expect(screen.getByLabelText('Headline')).toHaveValue('Not saved yet');
    expect(unsaved()).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Save draft' })).toBeEnabled();
  });

  it('asks before in-app navigation when dirty; Stay keeps the edits', async () => {
    mockLoad();
    const user = userEvent.setup();
    render(<ThemePage />);
    await editHeadline(user, 'Keep me');
    const link = internalLink();
    await user.click(link);

    const dialog = screen.getByRole('dialog', { name: /discard unsaved theme changes/i });
    expect(dialog).toHaveTextContent(/have not been saved/i);
    // Safe default: focus starts on Stay, so Enter cannot discard by accident.
    expect(screen.getByRole('button', { name: 'Stay on page' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Stay on page' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByLabelText('Headline')).toHaveValue('Keep me');
    expect(routerPush).not.toHaveBeenCalled();
    expect(routerReplace).not.toHaveBeenCalled();
    link.remove();
  });

  it('Escape keeps the edits; Discard navigates', async () => {
    mockLoad();
    const user = userEvent.setup();
    render(<ThemePage />);
    await editHeadline(user, 'Discard me');
    const link = internalLink('/dashboard/products');
    await user.click(link);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();

    await user.click(link);
    await user.click(screen.getByRole('button', { name: 'Discard changes' }));
    const navigated = [...routerPush.mock.calls, ...routerReplace.mock.calls].map((call) => call[0]);
    expect(navigated).toEqual(['/dashboard/products']);
    link.remove();
  });

  it('does not interfere with navigation when clean', async () => {
    mockLoad();
    const user = userEvent.setup();
    render(<ThemePage />);
    await screen.findByLabelText('Brand name');
    const link = internalLink();
    let prevented = true;
    link.addEventListener('click', (event) => {
      prevented = event.defaultPrevented;
      event.preventDefault(); // jsdom cannot navigate
    });
    await user.click(link);
    expect(prevented).toBe(false);
    expect(screen.queryByRole('dialog')).toBeNull();
    link.remove();
  });

  it('asks before switching themes when dirty', async () => {
    mockLoad();
    api.patch.mockResolvedValue({ success: true, data: storeTheme });
    const user = userEvent.setup();
    render(<ThemePage />);
    await editHeadline(user, 'Unsaved on Default');
    await openThemeList(user);
    await user.click(screen.getByRole('button', { name: 'Edit Minimal' }));
    expect(screen.getByRole('dialog', { name: /discard unsaved theme changes/i })).toHaveTextContent(
      /live storefront is not affected/i,
    );
    await user.click(screen.getByRole('button', { name: 'Keep editing' }));
    expect(api.patch).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Headline')).toHaveValue('Unsaved on Default');

    await user.click(screen.getByRole('button', { name: 'Edit Minimal' }));
    await user.click(screen.getByRole('button', { name: 'Discard changes' }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/stores/store-1/theme', { themeId: 'theme-minimal' }));
    expect(api.post).not.toHaveBeenCalled();
  });

  it('makes fields read-only while a theme switch is loading', async () => {
    mockLoad();
    let finishSwitch!: (value: unknown) => void;
    api.patch.mockReturnValue(new Promise((resolve) => (finishSwitch = resolve)));
    const user = userEvent.setup();
    render(<ThemePage />);
    await screen.findByLabelText('Brand name');
    await openThemeList(user);
    await user.click(screen.getByRole('button', { name: 'Edit Minimal' }));
    expect(screen.getByLabelText('Headline')).toBeDisabled();
    finishSwitch({ success: true, data: storeTheme });
    await waitFor(() => expect(screen.getByLabelText('Headline')).toBeEnabled());
  });

  it('switches themes without asking when clean', async () => {
    mockLoad();
    api.patch.mockResolvedValue({ success: true, data: storeTheme });
    const user = userEvent.setup();
    render(<ThemePage />);
    await screen.findByLabelText('Brand name');
    await openThemeList(user);
    await user.click(screen.getByRole('button', { name: 'Edit Minimal' }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/stores/store-1/theme', { themeId: 'theme-minimal' }));
    expect(screen.queryByRole('dialog', { name: /discard/i })).toBeNull();
  });

  it('reset asks first; Cancel keeps the unsaved edit', async () => {
    mockLoad();
    api.post.mockResolvedValue({ success: true, data: storeTheme });
    const user = userEvent.setup();
    render(<ThemePage />);
    await editHeadline(user, 'Before reset');
    await user.click(screen.getByRole('button', { name: 'Reset' }));
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByLabelText('Headline')).toHaveValue('Before reset');
    expect(api.post).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Reset' }));
    await user.click(screen.getByRole('button', { name: 'Reset draft' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/stores/store-1/theme/reset'));
    expect(unsaved()).toBeNull();
  });

  it('publish with unsaved edits saves them first, then publishes and ends clean', async () => {
    mockLoad();
    const saved: StoreTheme = {
      ...storeTheme,
      configuration: { ...storeTheme.configuration, hero: { ...storeTheme.configuration.hero, headline: 'B' } },
    };
    api.patch.mockResolvedValue({ success: true, data: saved });
    api.post.mockResolvedValue({ success: true, data: { ...saved, isLive: true, hasUnpublishedChanges: false } });
    const user = userEvent.setup();
    render(<ThemePage />);
    await editHeadline(user, 'B');
    await user.click(screen.getByRole('button', { name: 'Publish' }));
    expect(screen.getByRole('dialog')).toHaveTextContent(/unsaved changes are saved first/i);
    await user.click(screen.getByRole('button', { name: 'Save and publish' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/stores/store-1/theme/publish'));
    expect(api.patch).toHaveBeenCalledWith('/stores/store-1/theme', { configuration: { hero: { headline: 'B' } } });
    expect(api.patch.mock.invocationCallOrder[0]).toBeLessThan(api.post.mock.invocationCallOrder[0] ?? 0);
    expect(unsaved()).toBeNull();
  });

  it('does not publish when saving the unsaved edits fails', async () => {
    mockLoad();
    api.patch.mockRejectedValue(new ApiError(500, 'INTERNAL', 'Server unavailable'));
    const user = userEvent.setup();
    render(<ThemePage />);
    await editHeadline(user, 'B');
    await user.click(screen.getByRole('button', { name: 'Publish' }));
    await user.click(screen.getByRole('button', { name: 'Save and publish' }));
    await waitFor(() => expect(pushToast).toHaveBeenCalledWith(expect.any(String), 'error'));
    expect(api.post).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Headline')).toHaveValue('B');
    expect(unsaved()).not.toBeNull();
  });

  it('store switch and log out ask through confirmLeave while dirty', async () => {
    const { confirmLeave } = await import('@/lib/leave-guard');
    mockLoad();
    const user = userEvent.setup();
    render(<ThemePage />);
    await screen.findByLabelText('Brand name');
    await expect(confirmLeave()).resolves.toBe(true);

    await editHeadline(user, 'Dirty');
    const stay = confirmLeave();
    await user.click(await screen.findByRole('button', { name: 'Stay on page' }));
    await expect(stay).resolves.toBe(false);

    const leave = confirmLeave();
    await user.click(await screen.findByRole('button', { name: 'Discard changes' }));
    await expect(leave).resolves.toBe(true);
  });
});

// TE-05: an invalid color is never silently dropped while the UI reports a
// successful save. The contract matches the API: #rgb / #rrggbb, trimmed.
describe('Theme customizer: color validation (TE-05)', () => {
  beforeEach(() => {
    canManage = true;
    pushToast.mockReset();
    routerPush.mockReset();
    routerReplace.mockReset();
    api.get.mockReset();
    api.post.mockReset();
    api.patch.mockReset();
  });

  const COLOR_FIELDS: Array<[string, (c: StoreTheme['configuration']) => unknown]> = [
    ['Primary color', (c) => c.branding?.primaryColor],
    ['Secondary color', (c) => c.branding?.secondaryColor],
    ['Accent color', (c) => c.branding?.accentColor],
    ['Background color', (c) => c.branding?.backgroundColor],
    ['Surface color', (c) => c.branding?.surfaceColor],
    ['Text color', (c) => c.branding?.textColor],
    ['Muted text color', (c) => c.branding?.mutedTextColor],
  ];
  // Announcement colors share labels with branding, so they are addressed by position.
  const allColored: StoreTheme = {
    ...storeTheme,
    configuration: {
      ...storeTheme.configuration,
      branding: {
        ...storeTheme.configuration.branding,
        primaryColor: '#112233',
        secondaryColor: '#223344',
        accentColor: '#334455',
        backgroundColor: '#ffffff',
        surfaceColor: '#f8fafc',
        textColor: '#0f172a',
        mutedTextColor: '#64748b',
      },
    },
  };
  function load(theme = allColored, saved = theme) {
    api.get.mockImplementation((path: string) =>
      path.endsWith('/themes')
        ? Promise.resolve({ success: true, data: { items: themes, meta: { total: 2 } } })
        : Promise.resolve({ success: true, data: theme }),
    );
    api.patch.mockResolvedValue({ success: true, data: saved });
  }
  const colorInput = (label: string, index = 0) =>
    screen.getAllByLabelText(label, { exact: true }).filter((el) => el.getAttribute('type') !== 'color')[index] as HTMLInputElement;
  async function typeColor(user: ReturnType<typeof userEvent.setup>, input: HTMLInputElement, value: string) {
    await user.clear(input);
    if (value) {
      await user.click(input);
      await user.paste(value);
    }
  }
  const save = (user: ReturnType<typeof userEvent.setup>) =>
    user.click(screen.getByRole('button', { name: 'Save draft' }));
  const sentConfig = () =>
    (api.patch.mock.calls[0] as [string, { configuration: StoreTheme['configuration'] }])[1].configuration;

  it.each([
    ['6-digit lowercase', '#a1b2c3', '#a1b2c3'],
    ['6-digit uppercase', '#A1B2C3', '#A1B2C3'],
    ['3-digit', '#AbC', '#AbC'],
    ['surrounding spaces (trimmed, as the API does)', '  #abcdef  ', '#abcdef'],
  ])('saves a valid color: %s', async (_name, typed, sent) => {
    load();
    const user = userEvent.setup();
    render(<ThemePage />);
    await screen.findByLabelText('Brand name');
    const input = colorInput('Primary color');
    await typeColor(user, input, typed);
    expect(input).not.toHaveAttribute('aria-invalid');
    await save(user);
    await waitFor(() => expect(api.patch).toHaveBeenCalledTimes(1));
    expect(sentConfig()).toEqual({ branding: { primaryColor: sent } });
    await waitFor(() => expect(pushToast).toHaveBeenCalledWith('Draft saved', 'success'));
  });

  it.each([
    ['missing #', 'a1b2c3'],
    ['invalid characters', '#12zz99'],
    ['too short', '#12'],
    ['too long', '#1234567'],
    ['8-digit', '#11223344'],
    ['whitespace only (saved color)', '   '],
    ['empty (saved color)', ''],
    ['pasted malformed', '#12 34 56'],
    ['CSS function', 'rgb(1, 2, 3)'],
    ['CSS variable', 'var(--color)'],
    ['url()', 'url(https://evil.example.com/x)'],
    ['HTML/script-like', '<script>alert(1)</script>'],
    ['CSS injection', '#fff;background:red'],
  ])('blocks an invalid color: %s', async (_name, typed) => {
    load();
    const user = userEvent.setup();
    render(<ThemePage />);
    await screen.findByLabelText('Brand name');
    const input = colorInput('Primary color');
    await typeColor(user, input, typed);

    // Field-level feedback, linked to the input and readable without color.
    expect(input).toHaveAttribute('aria-invalid', 'true');
    const message = document.getElementById(input.getAttribute('aria-describedby') ?? '');
    expect(message).toHaveTextContent(/Invalid color: Enter a hex color such as #fff or #1a2b3c/);

    await save(user);
    expect(api.patch).not.toHaveBeenCalled();
    expect(pushToast).toHaveBeenCalledWith('Not saved. Fix the invalid color: Primary color.', 'error');
    expect(pushToast).not.toHaveBeenCalledWith('Draft saved', 'success');
    // The merchant's text stays, and the editor stays unsaved.
    expect(input).toHaveValue(typed);
    expect(screen.getByTestId('unsaved-indicator')).toBeInTheDocument();
  });

  it.each(COLOR_FIELDS)('%s: invalid blocks, valid saves', async (label, read) => {
    load();
    const user = userEvent.setup();
    render(<ThemePage />);
    await screen.findByLabelText('Brand name');
    const input = colorInput(label);
    await typeColor(user, input, 'red');
    await save(user);
    expect(api.patch).not.toHaveBeenCalled();
    await typeColor(user, input, '#0a0b0c');
    await save(user);
    await waitFor(() => expect(api.patch).toHaveBeenCalledTimes(1));
    expect(read(sentConfig())).toBe('#0a0b0c');
  });

  it.each([
    ['announcement background', 0],
    ['announcement text', 1],
  ])('%s color: invalid blocks, valid saves', async (_name, index) => {
    const theme: StoreTheme = {
      ...allColored,
      configuration: {
        ...allColored.configuration,
        announcement: { enabled: true, text: 'Hi', backgroundColor: '#000000', textColor: '#ffffff' },
      },
    };
    load(theme);
    const user = userEvent.setup();
    render(<ThemePage />);
    await screen.findByLabelText('Brand name');
    const label = index === 0 ? 'Background color' : 'Text color';
    const input = colorInput(label, 1); // [0] is branding, [1] is announcement
    await typeColor(user, input, 'var(--x)');
    await save(user);
    expect(api.patch).not.toHaveBeenCalled();
    expect(pushToast).toHaveBeenCalledWith(
      `Not saved. Fix the invalid color: Announcement ${index === 0 ? 'background' : 'text'} color.`,
      'error',
    );
    await typeColor(user, input, '#123456');
    await save(user);
    await waitFor(() => expect(api.patch).toHaveBeenCalledTimes(1));
    expect(sentConfig().announcement).toEqual(index === 0 ? { backgroundColor: '#123456' } : { textColor: '#123456' });
  });

  it('lists every invalid color at once', async () => {
    load();
    const user = userEvent.setup();
    render(<ThemePage />);
    await screen.findByLabelText('Brand name');
    await typeColor(user, colorInput('Primary color'), 'nope');
    await typeColor(user, colorInput('Muted text color'), '#12');
    await save(user);
    expect(pushToast).toHaveBeenCalledWith('Not saved. Fix the invalid colors: Primary color, Muted text color.', 'error');
  });

  it('an unset color that is typed in and cleared again stays unset, clean and saveable', async () => {
    const unset: StoreTheme = {
      ...storeTheme,
      configuration: { ...storeTheme.configuration, branding: { brandName: 'Alpha Goods' } },
    };
    load(unset);
    const user = userEvent.setup();
    render(<ThemePage />);
    await screen.findByLabelText('Brand name');
    const input = colorInput('Accent color');
    await typeColor(user, input, '#abc');
    await typeColor(user, input, '');
    expect(input).not.toHaveAttribute('aria-invalid');
    expect(screen.queryByTestId('unsaved-indicator')).toBeNull();
  });

  it('stays unsaved and guarded while invalid; fixing it and saving clears it only after the server confirms', async () => {
    const savedTheme: StoreTheme = {
      ...allColored,
      configuration: { ...allColored.configuration, branding: { ...allColored.configuration.branding, primaryColor: '#445566' } },
    };
    load(allColored, savedTheme);
    let finish!: (value: unknown) => void;
    api.patch.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const user = userEvent.setup();
    render(<ThemePage />);
    await screen.findByLabelText('Brand name');
    const input = colorInput('Primary color');
    await typeColor(user, input, '#44556');
    expect(screen.getByTestId('unsaved-indicator')).toBeInTheDocument();
    const beforeUnload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(beforeUnload);
    expect(beforeUnload.defaultPrevented).toBe(true);

    await typeColor(user, input, '#445566');
    await save(user);
    expect(screen.getByTestId('unsaved-indicator')).toBeInTheDocument(); // still pending
    finish({ success: true, data: savedTheme });
    await waitFor(() => expect(screen.queryByTestId('unsaved-indicator')).toBeNull());
  });

  it('Save and publish with an invalid color neither saves nor publishes', async () => {
    load();
    api.post.mockResolvedValue({ success: true, data: allColored });
    const user = userEvent.setup();
    render(<ThemePage />);
    await screen.findByLabelText('Brand name');
    await typeColor(user, colorInput('Primary color'), 'rgb(0,0,0)');
    await user.click(screen.getByRole('button', { name: 'Publish' }));
    await user.click(screen.getByRole('button', { name: 'Save and publish' }));
    await waitFor(() => expect(pushToast).toHaveBeenCalledWith(expect.stringMatching(/^Not saved/), 'error'));
    expect(api.patch).not.toHaveBeenCalled();
    expect(api.post).not.toHaveBeenCalled();
    expect(colorInput('Primary color')).toHaveValue('rgb(0,0,0)');
  });

  it('Save and publish with a valid color saves then publishes', async () => {
    const savedTheme: StoreTheme = {
      ...allColored,
      configuration: { ...allColored.configuration, branding: { ...allColored.configuration.branding, primaryColor: '#abcdef' } },
    };
    load(allColored, savedTheme);
    api.post.mockResolvedValue({ success: true, data: { ...savedTheme, isLive: true, hasUnpublishedChanges: false } });
    const user = userEvent.setup();
    render(<ThemePage />);
    await screen.findByLabelText('Brand name');
    await typeColor(user, colorInput('Primary color'), '#ABCDEF');
    await user.click(screen.getByRole('button', { name: 'Publish' }));
    await user.click(screen.getByRole('button', { name: 'Save and publish' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/stores/store-1/theme/publish'));
    expect(sentConfig()).toEqual({ branding: { primaryColor: '#ABCDEF' } });
  });

  it('the preview never renders an invalid color', async () => {
    load();
    const user = userEvent.setup();
    render(<ThemePage />);
    await screen.findByLabelText('Brand name');
    await typeColor(user, colorInput('Primary color'), 'red;}body{display:none');
    const preview = screen.getByRole('region', { name: 'Storefront preview' });
    expect(preview.outerHTML).not.toContain('display:none');
  });
});

// TE-06: the font dropdown offers exactly the API whitelist, and an API font
// rejection is reported as an error without touching the editor state.
describe('Theme customizer: font whitelist (TE-06)', () => {
  const FONTS = ['Inter', 'Work Sans', 'IBM Plex Sans', 'Source Sans 3', 'Georgia', 'Fraunces', 'System'];

  beforeEach(() => {
    canManage = true;
    pushToast.mockReset();
    routerPush.mockReset();
    routerReplace.mockReset();
    api.get.mockReset();
    api.post.mockReset();
    api.patch.mockReset();
  });

  function load(theme: StoreTheme = storeTheme) {
    api.get.mockImplementation((path: string) =>
      path.endsWith('/themes')
        ? Promise.resolve({ success: true, data: { items: themes, meta: { total: 2 } } })
        : Promise.resolve({ success: true, data: theme }),
    );
  }

  it.each(['Heading font', 'Body font'])('%s offers exactly the whitelisted families', async (label) => {
    load();
    render(<ThemePage />);
    const select = await screen.findByLabelText(label);
    const options = Array.from((select as HTMLSelectElement).options).map((o) => o.value);
    expect(options).toEqual(FONTS);
  });

  it.each(FONTS)('selecting %s saves exactly that family', async (font) => {
    load();
    const target = font === 'Inter' ? 'Body font' : 'Heading font'; // fixture already uses Inter for both
    const saved: StoreTheme = {
      ...storeTheme,
      configuration: {
        ...storeTheme.configuration,
        typography: {
          ...storeTheme.configuration.typography,
          [target === 'Heading font' ? 'headingFont' : 'bodyFont']: font === 'Inter' ? 'Georgia' : font,
        },
      },
    };
    api.patch.mockResolvedValue({ success: true, data: saved });
    const user = userEvent.setup();
    render(<ThemePage />);
    const select = await screen.findByLabelText(target);
    const value = font === 'Inter' ? 'Georgia' : font;
    await user.selectOptions(select, value);
    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledTimes(1));
    const sent = (api.patch.mock.calls[0] as [string, { configuration: StoreTheme['configuration'] }])[1].configuration;
    expect(sent).toEqual({ typography: { [target === 'Heading font' ? 'headingFont' : 'bodyFont']: value } });
    await waitFor(() => expect(pushToast).toHaveBeenCalledWith('Draft saved', 'success'));
  });

  it('a non-whitelisted font cannot be chosen in the UI', async () => {
    load();
    const user = userEvent.setup();
    render(<ThemePage />);
    const select = await screen.findByLabelText('Heading font');
    await expect(user.selectOptions(select, 'Comic Sans MS')).rejects.toThrow();
    expect(select).toHaveValue('Inter');
  });

  it('an API font rejection is shown as an error; edits and the unsaved state are kept', async () => {
    load();
    api.patch.mockRejectedValue(
      new ApiError(400, 'BAD_REQUEST', 'configuration.typography.headingFont must be one of: Inter, Work Sans, IBM Plex Sans, Source Sans 3, Georgia, Fraunces, System'),
    );
    const user = userEvent.setup();
    render(<ThemePage />);
    const select = await screen.findByLabelText('Heading font');
    await user.selectOptions(select, 'Fraunces');
    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() =>
      expect(pushToast).toHaveBeenCalledWith(expect.stringMatching(/headingFont must be one of/), 'error'),
    );
    expect(pushToast).not.toHaveBeenCalledWith('Draft saved', 'success');
    expect(select).toHaveValue('Fraunces');
    expect(screen.getByTestId('unsaved-indicator')).toBeInTheDocument();
  });

  it('Save and publish does not publish when the API rejects the font', async () => {
    load();
    api.patch.mockRejectedValue(new ApiError(400, 'BAD_REQUEST', 'configuration.typography.bodyFont must be one of: Inter'));
    const user = userEvent.setup();
    render(<ThemePage />);
    await user.selectOptions(await screen.findByLabelText('Body font'), 'Georgia');
    await user.click(screen.getByRole('button', { name: 'Publish' }));
    await user.click(screen.getByRole('button', { name: 'Save and publish' }));
    await waitFor(() => expect(pushToast).toHaveBeenCalledWith(expect.stringMatching(/bodyFont must be one of/), 'error'));
    expect(api.post).not.toHaveBeenCalled();
  });

  it('a legacy stored font is left alone: not dirty, not re-sent on save', async () => {
    const legacy: StoreTheme = {
      ...storeTheme,
      configuration: {
        ...storeTheme.configuration,
        typography: { ...storeTheme.configuration.typography, headingFont: 'Legacy Font' },
      },
    };
    load(legacy);
    api.patch.mockResolvedValue({ success: true, data: legacy });
    const user = userEvent.setup();
    render(<ThemePage />);
    await screen.findByLabelText('Brand name');
    expect(screen.queryByTestId('unsaved-indicator')).toBeNull();
    const headline = screen.getByLabelText('Headline');
    await user.clear(headline);
    await user.type(headline, 'Edited');
    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledTimes(1));
    const sent = (api.patch.mock.calls[0] as [string, { configuration: StoreTheme['configuration'] }])[1].configuration;
    expect(sent).toEqual({ hero: { headline: 'Edited' } });
  });
});
