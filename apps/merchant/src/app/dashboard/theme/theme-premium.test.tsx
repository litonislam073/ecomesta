import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { StoreTheme, ThemeListItem } from '@ecomesta/types';
import ThemePage from '@/app/dashboard/theme/page';
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

const base = {
  version: '1.0.0',
  previewImageUrl: null,
  selected: false,
  live: false,
};

const premium = (over: Partial<ThemeListItem>): ThemeListItem => ({
  ...base,
  id: 'theme-shopease',
  name: 'ShopEase',
  slug: 'shopease',
  description: 'Premium storefront.',
  premium: true,
  priceBdt: '999.00',
  access: 'locked',
  purchase: null,
  ...over,
});

function mockThemes(items: ThemeListItem[]) {
  api.get.mockImplementation((path: string) => {
    if (path.endsWith('/themes')) return Promise.resolve({ success: true, data: { items } });
    if (path === '/billing/payment-accounts') {
      return Promise.resolve({
        success: true,
        data: [{ method: 'BKASH', label: 'bKash', number: '01700000000', transferType: 'Send Money' }],
      });
    }
    return Promise.resolve({ success: true, data: storeTheme });
  });
}

const defaultTheme: ThemeListItem = {
  ...base,
  id: 'theme-default',
  name: 'Default',
  slug: 'default',
  description: null,
  selected: true,
  premium: false,
  priceBdt: null,
  access: 'free',
  purchase: null,
};

/** Theme settings tab → Theme: the list of themes (switch or buy). */
async function openThemeList(user = userEvent.setup()) {
  await user.click(await screen.findByRole('tab', { name: 'Theme settings' }));
  await user.click(screen.getByRole('button', { name: /^Theme: / }));
}

describe('Premium themes', () => {
  beforeEach(() => {
    canManage = true;
    pushToast.mockReset();
    api.get.mockReset();
    api.post.mockReset();
    api.patch.mockReset();
  });

  it('a locked premium theme offers Buy instead of Edit', async () => {
    mockThemes([defaultTheme, premium({})]);
    render(<ThemePage />);
    await openThemeList();
    expect(await screen.findByRole('button', { name: 'Buy for ৳999' })).toBeInTheDocument();
    expect(screen.getByText('Premium · ৳999')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit ShopEase' })).toBeNull();
    expect(screen.getByRole('link', { name: 'or get it with the Business plan' })).toHaveAttribute('href', '/dashboard/billing');
  });

  it('buys the theme by wallet: the payment is submitted and the theme waits for review', async () => {
    mockThemes([defaultTheme, premium({})]);
    api.post.mockResolvedValue({
      success: true,
      data: {
        id: 'tp-1',
        theme: { id: 'theme-shopease', slug: 'shopease', name: 'ShopEase' },
        amount: '999.00',
        currency: 'BDT',
        method: 'BKASH',
        senderNumber: '01711111111',
        transactionId: 'TRX12345',
        status: 'PENDING',
        rejectionReason: null,
        createdAt: '2026-10-08T00:00:00.000Z',
      },
    });
    const user = userEvent.setup();
    render(<ThemePage />);
    await openThemeList();

    await user.click(await screen.findByRole('button', { name: 'Buy for ৳999' }));
    const dialog = await screen.findByRole('dialog', { name: 'Buy the ShopEase theme' });
    expect(dialog).toHaveTextContent('ShopEase theme');
    expect(dialog).toHaveTextContent('৳999');
    const submit = await screen.findByRole('button', { name: 'Pay ৳999 with bKash' });
    expect(submit).toBeDisabled();

    await user.type(screen.getByLabelText('Your bKash number'), '01711111111');
    await user.type(screen.getByLabelText('Transaction ID'), 'trx12345');
    await user.click(submit);

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/stores/store-1/themes/theme-shopease/purchase', {
        method: 'BKASH',
        senderNumber: '01711111111',
        transactionId: 'TRX12345',
      }),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByText(/Payment under review \(TrxID TRX12345\)/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Buy for ৳999' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit ShopEase' })).toBeNull();
    expect(pushToast).toHaveBeenCalledWith(expect.stringContaining('Payment submitted'), 'success');
  });

  it('shows an API refusal inside the payment dialog', async () => {
    mockThemes([defaultTheme, premium({})]);
    api.post.mockRejectedValue(new ApiError(409, 'TRANSACTION_ID_USED', 'This transaction ID was already used.'));
    const user = userEvent.setup();
    render(<ThemePage />);
    await openThemeList();
    await user.click(await screen.findByRole('button', { name: 'Buy for ৳999' }));
    await user.type(await screen.findByLabelText('Your bKash number'), '01711111111');
    await user.type(screen.getByLabelText('Transaction ID'), 'TRX12345');
    await user.click(screen.getByRole('button', { name: 'Pay ৳999 with bKash' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('already used');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('an included or owned premium theme can be edited', async () => {
    mockThemes([defaultTheme, premium({ access: 'included' })]);
    render(<ThemePage />);
    await openThemeList();
    expect(await screen.findByRole('button', { name: 'Edit ShopEase' })).toBeInTheDocument();
    expect(screen.getByText('✓ Included in your plan')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Buy for/ })).toBeNull();
  });

  it('explains a rejected payment and lets the merchant pay again', async () => {
    mockThemes([
      defaultTheme,
      premium({
        purchase: { status: 'REJECTED', rejectionReason: 'Amount did not match', transactionId: 'OLD1234', createdAt: '' },
      }),
    ]);
    render(<ThemePage />);
    await openThemeList();
    expect(await screen.findByText(/Your last payment was not approved: Amount did not match/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Buy for ৳999' })).toBeInTheDocument();
  });

  it('read-only members see the premium state but cannot buy', async () => {
    canManage = false;
    mockThemes([defaultTheme, premium({})]);
    render(<ThemePage />);
    await openThemeList();
    expect(await screen.findByText('Premium · ৳999')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Buy for/ })).toBeNull();
  });
});
