import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { StoreSettings, StoreSettingsSummary } from '@ecomesta/types';
import SettingsOverviewPage from '@/app/dashboard/settings/page';
import SettingsLayout from '@/app/dashboard/settings/layout';
import GeneralSettingsPage from '@/app/dashboard/settings/general/page';
import StoreDetailsSettingsPage from '@/app/dashboard/settings/store/page';
import CheckoutSettingsPage from '@/app/dashboard/settings/checkout/page';
import OrderSettingsPage from '@/app/dashboard/settings/orders/page';
import CustomerSettingsPage from '@/app/dashboard/settings/customers/page';
import NotificationSettingsPage from '@/app/dashboard/settings/notifications/page';
import ShippingSettingsPage from '@/app/dashboard/settings/shipping/page';
import DomainSettingsPage from '@/app/dashboard/settings/domains/page';
import SeoSettingsPage from '@/app/dashboard/settings/seo/page';
import DangerZoneSettingsPage from '@/app/dashboard/settings/danger-zone/page';
import { SidebarNav } from '@/components/dashboard/sidebar-nav';
import { ApiError } from '@/lib/api-client';
import { SETTINGS_NAV } from '@/lib/nav';

const pushToast = vi.fn();
const routerPush = vi.fn();
let pathname = '/dashboard/settings';

vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push: routerPush, replace: vi.fn(), refresh: vi.fn() }),
}));

vi.mock('@/lib/store-context', () => ({
  useStoreContext: () => ({
    selectedStoreId: 'store-1',
    selectedStore: null,
    stores: [],
    loading: false,
    error: null,
    setSelectedStoreId: vi.fn(),
    refreshStores: vi.fn(),
  }),
}));

vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ pushToast }),
}));

const api = { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() };

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

const baseSettings: StoreSettings = {
  storeId: 'store-1',
  name: 'Alpha Store',
  slug: 'alpha',
  status: 'ACTIVE',
  businessName: 'Alpha Ltd',
  description: 'Handmade goods',
  email: 'hello@alpha.example.com',
  phone: '+8801711000000',
  address: 'Dhanmondi, Dhaka',
  currency: 'BDT',
  timezone: 'Asia/Dhaka',
  defaultLanguage: 'en',
  locale: 'en-BD',
  checkoutRequirePhone: false,
  checkoutAllowOrderNotes: true,
  allowCustomerCancellation: false,
  seoTitle: 'Alpha handmade goods',
  seoDescription: null,
  seoKeywords: ['handmade'],
  ogTitle: null,
  ogDescription: null,
  ogImageUrl: null,
  seoIndexingEnabled: true,
  fixed: {
    guestCheckout: true,
    requireEmail: true,
    requireShippingAddress: true,
    currencyEditable: false,
    timezoneEditable: false,
    slugEditable: false,
    customerCancellableStatuses: ['PENDING', 'CONFIRMED'],
  },
  permissions: { canEdit: true },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
};

const summary: StoreSettingsSummary = {
  payments: {
    offlineMethods: ['COD', 'BANK_TRANSFER', 'OTHER'],
    onlineProviders: [{ provider: 'SSL_COMMERZ', mode: 'test' }],
  },
  shipping: { methodCount: 3, activeMethodCount: 2, codMethodCount: 1, zoneCount: 4 },
  domains: {
    platformHostname: 'alpha.ecomesta.com',
    primaryHostname: 'shop.alpha.com',
    customDomainCount: 1,
    activeCustomDomainCount: 1,
    pendingCustomDomainCount: 0,
  },
  theme: { name: 'Minimal', publishedAt: null, logoUrl: null, faviconUrl: null },
};

function mockLoad(settings: StoreSettings = baseSettings) {
  api.get.mockImplementation((path: string) => {
    if (path.endsWith('/settings/summary')) {
      return Promise.resolve({ success: true, data: summary });
    }
    if (path.endsWith('/settings')) {
      return Promise.resolve({ success: true, data: settings });
    }
    return Promise.reject(new Error(`unexpected GET ${path}`));
  });
}

const readOnly: StoreSettings = { ...baseSettings, permissions: { canEdit: false } };

describe('Merchant settings', () => {
  beforeEach(() => {
    pathname = '/dashboard/settings';
    mockLoad();
  });

  describe('navigation', () => {
    it('shows nested settings links in the dashboard sidebar on settings routes', () => {
      pathname = '/dashboard/settings/seo';
      render(<SidebarNav />);
      const sections = screen.getByRole('list', { name: 'Settings sections' });
      for (const label of ['General', 'Checkout', 'Payments', 'SEO', 'Danger zone']) {
        expect(within(sections).getByRole('link', { name: label })).toBeInTheDocument();
      }
      expect(within(sections).getByRole('link', { name: 'SEO' })).toHaveAttribute(
        'aria-current',
        'page',
      );
      expect(screen.getByRole('link', { name: 'Theme' })).toHaveAttribute(
        'href',
        '/dashboard/theme',
      );
    });

    it('collapses settings children elsewhere in the dashboard', () => {
      pathname = '/dashboard/orders';
      render(<SidebarNav />);
      expect(screen.queryByRole('list', { name: 'Settings sections' })).toBeNull();
      expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute(
        'href',
        '/dashboard/settings',
      );
    });

    it('renders a desktop settings nav and a mobile section picker', async () => {
      pathname = '/dashboard/settings/checkout';
      const user = userEvent.setup();
      render(
        <SettingsLayout>
          <p>content</p>
        </SettingsLayout>,
      );
      const nav = screen.getByRole('navigation', { name: 'Settings' });
      expect(within(nav).getAllByRole('link')).toHaveLength(SETTINGS_NAV.length);
      expect(within(nav).getByRole('link', { name: 'Checkout' })).toHaveAttribute(
        'aria-current',
        'page',
      );

      const picker = screen.getByLabelText('Settings section');
      expect(picker).toHaveValue('/dashboard/settings/checkout');
      await user.selectOptions(picker, '/dashboard/settings/seo');
      expect(routerPush).toHaveBeenCalledWith('/dashboard/settings/seo');
    });

    it('links payments to the existing provider settings page', () => {
      expect(SETTINGS_NAV.find((i) => i.label === 'Payments')?.href).toBe(
        '/dashboard/settings/payments',
      );
    });
  });

  describe('overview', () => {
    it('summarises every settings area with working links', async () => {
      render(<SettingsOverviewPage />);
      expect(await screen.findByRole('link', { name: /general/i })).toHaveAttribute(
        'href',
        '/dashboard/settings/general',
      );
      expect(screen.getByRole('link', { name: /^theme/i })).toHaveAttribute(
        'href',
        '/dashboard/theme',
      );
      expect(screen.getByText('BDT · Asia/Dhaka')).toBeInTheDocument();
      expect(await screen.findByText('Online: SSL_COMMERZ (test)')).toBeInTheDocument();
      expect(screen.getByText('4 zones')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /danger zone/i })).toHaveAttribute(
        'href',
        '/dashboard/settings/danger-zone',
      );
    });

    it('shows an error state when settings fail to load', async () => {
      api.get.mockRejectedValue(new ApiError(500, 'INTERNAL', 'Server unavailable'));
      render(<SettingsOverviewPage />);
      expect(await screen.findByText('Server unavailable')).toBeInTheDocument();
    });
  });

  describe('general', () => {
    it('saves only changed fields with the concurrency token', async () => {
      api.patch.mockResolvedValue({
        success: true,
        data: { ...baseSettings, name: 'Alpha BD', defaultLanguage: 'bn', locale: 'bn-BD' },
      });
      const user = userEvent.setup();
      render(<GeneralSettingsPage />);

      const name = await screen.findByLabelText('Store name');
      await user.clear(name);
      await user.type(name, 'Alpha BD');
      await user.selectOptions(screen.getByLabelText('Storefront language'), 'bn');
      await user.click(screen.getByRole('button', { name: 'Save changes' }));

      await waitFor(() =>
        expect(api.patch).toHaveBeenCalledWith('/stores/store-1/settings', {
          name: 'Alpha BD',
          defaultLanguage: 'bn',
          expectedUpdatedAt: baseSettings.updatedAt,
        }),
      );
      expect(pushToast).toHaveBeenCalledWith('General settings saved', 'success');
      expect(screen.getByText('BDT')).toBeInTheDocument();
      expect(screen.getByText('Asia/Dhaka')).toBeInTheDocument();
    });

    it('blocks an empty store name client-side', async () => {
      const user = userEvent.setup();
      render(<GeneralSettingsPage />);
      await user.clear(await screen.findByLabelText('Store name'));
      await user.click(screen.getByRole('button', { name: 'Save changes' }));
      expect(await screen.findByText(/at least 2 characters/i)).toBeInTheDocument();
      expect(api.patch).not.toHaveBeenCalled();
    });

    it('surfaces API validation and conflict errors', async () => {
      api.patch.mockRejectedValueOnce(
        new ApiError(409, 'CONFLICT', 'These settings were changed by someone else. Reload to see the latest values.'),
      );
      const user = userEvent.setup();
      render(<GeneralSettingsPage />);
      await user.type(await screen.findByLabelText('Description'), ' and more');
      await user.click(screen.getByRole('button', { name: 'Save changes' }));
      await waitFor(() =>
        expect(pushToast).toHaveBeenCalledWith(
          expect.stringMatching(/changed by someone else/),
          'error',
        ),
      );
    });

    it('is read-only for staff', async () => {
      mockLoad(readOnly);
      render(<GeneralSettingsPage />);
      expect(await screen.findByLabelText('Store name')).toBeDisabled();
      expect(screen.getByRole('note')).toHaveTextContent(/read-only access/i);
      expect(screen.queryByRole('button', { name: 'Save changes' })).toBeNull();
    });
  });

  describe('store details', () => {
    it('validates email and phone before saving', async () => {
      const user = userEvent.setup();
      render(<StoreDetailsSettingsPage />);
      const email = await screen.findByLabelText('Support email');
      await user.clear(email);
      await user.type(email, 'not-an-email');
      expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Save changes' }));
      expect(api.patch).not.toHaveBeenCalled();
    });

    it('saves contact details', async () => {
      api.patch.mockResolvedValue({ success: true, data: { ...baseSettings, phone: '+8801811000000' } });
      const user = userEvent.setup();
      render(<StoreDetailsSettingsPage />);
      const phone = await screen.findByLabelText('Support phone');
      await user.clear(phone);
      await user.type(phone, '+8801811000000');
      await user.click(screen.getByRole('button', { name: 'Save changes' }));
      await waitFor(() =>
        expect(api.patch).toHaveBeenCalledWith(
          '/stores/store-1/settings',
          expect.objectContaining({ phone: '+8801811000000' }),
        ),
      );
    });
  });

  describe('checkout and orders', () => {
    it('toggles the phone requirement and shows fixed rules', async () => {
      api.patch.mockResolvedValue({
        success: true,
        data: { ...baseSettings, checkoutRequirePhone: true },
      });
      const user = userEvent.setup();
      render(<CheckoutSettingsPage />);
      await user.click(await screen.findByLabelText('Require a phone number'));
      await user.click(screen.getByRole('button', { name: 'Save changes' }));
      await waitFor(() =>
        expect(api.patch).toHaveBeenCalledWith('/stores/store-1/settings', {
          checkoutRequirePhone: true,
          expectedUpdatedAt: baseSettings.updatedAt,
        }),
      );
      expect(screen.getByText('Guest checkout')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Payment providers' })).toHaveAttribute(
        'href',
        '/dashboard/settings/payments',
      );
    });

    it('explains customer cancellation eligibility and saves the toggle', async () => {
      api.patch.mockResolvedValue({
        success: true,
        data: { ...baseSettings, allowCustomerCancellation: true },
      });
      const user = userEvent.setup();
      render(<OrderSettingsPage />);
      expect(await screen.findByText(/PENDING or CONFIRMED/)).toBeInTheDocument();
      await user.click(screen.getByLabelText('Let customers cancel their own orders'));
      await user.click(screen.getByRole('button', { name: 'Save changes' }));
      await waitFor(() =>
        expect(api.patch).toHaveBeenCalledWith(
          '/stores/store-1/settings',
          expect.objectContaining({ allowCustomerCancellation: true }),
        ),
      );
    });

    it('disables toggles for read-only users', async () => {
      mockLoad(readOnly);
      render(<CheckoutSettingsPage />);
      expect(await screen.findByLabelText('Require a phone number')).toBeDisabled();
    });
  });

  describe('informational pages', () => {
    it('customers page states guest checkout without customer accounts', async () => {
      render(<CustomerSettingsPage />);
      expect(
        await screen.findByText(/Storefront customer accounts are not available/),
      ).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'View customers' })).toHaveAttribute(
        'href',
        '/dashboard/customers',
      );
    });

    it('notifications page does not offer fake toggles', () => {
      render(<NotificationSettingsPage />);
      expect(
        screen.getByText(/Notification infrastructure will be connected when email delivery is enabled/),
      ).toBeInTheDocument();
      expect(screen.queryByRole('checkbox')).toBeNull();
    });

    it('shipping page summarises and links to shipping management', async () => {
      render(<ShippingSettingsPage />);
      expect(await screen.findByText('2 of 3')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Manage shipping' })).toHaveAttribute(
        'href',
        '/dashboard/shipping',
      );
    });

    it('domains page summarises and links to domain management without tokens', async () => {
      const { container } = render(<DomainSettingsPage />);
      expect(await screen.findByText('shop.alpha.com')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Manage domains' })).toHaveAttribute(
        'href',
        '/dashboard/domains',
      );
      expect(container.textContent).not.toMatch(/token/i);
    });

    it('danger zone has no destructive actions', async () => {
      render(<DangerZoneSettingsPage />);
      expect(
        await screen.findByText('Store deletion is managed by platform administration.'),
      ).toBeInTheDocument();
      expect(screen.queryByRole('button')).toBeNull();
    });
  });

  describe('SEO', () => {
    it('warns about length without blocking save', async () => {
      api.patch.mockResolvedValue({ success: true, data: { ...baseSettings, seoTitle: 'Short' } });
      const user = userEvent.setup();
      render(<SeoSettingsPage />);
      const title = await screen.findByLabelText('Page title');
      await user.clear(title);
      await user.type(title, 'Short');
      expect(screen.getByTestId('seo-title-warning')).toHaveTextContent(/Short title/);
      await user.click(screen.getByRole('button', { name: 'Save changes' }));
      await waitFor(() =>
        expect(api.patch).toHaveBeenCalledWith(
          '/stores/store-1/settings',
          expect.objectContaining({ seoTitle: 'Short' }),
        ),
      );
    });

    it('rejects javascript image URLs and markup client-side', async () => {
      const user = userEvent.setup();
      render(<SeoSettingsPage />);
      await user.type(await screen.findByLabelText('Share image URL'), 'javascript:alert(1)');
      expect(screen.getByText(/starting with https:\/\//)).toBeInTheDocument();
      await user.type(screen.getByLabelText('Meta description'), '<b>');
      expect(screen.getAllByText('Use plain text only (no < or >).').length).toBeGreaterThan(0);
      await user.click(screen.getByRole('button', { name: 'Save changes' }));
      expect(api.patch).not.toHaveBeenCalled();
    });

    it('parses keywords and shows the canonical address from domains', async () => {
      api.patch.mockResolvedValue({ success: true, data: baseSettings });
      const user = userEvent.setup();
      render(<SeoSettingsPage />);
      const keywords = await screen.findByLabelText('Keywords');
      await user.clear(keywords);
      await user.type(keywords, 'handmade, dhaka, Handmade');
      expect(await screen.findAllByText('https://shop.alpha.com/')).not.toHaveLength(0);
      await user.click(screen.getByRole('button', { name: 'Save changes' }));
      await waitFor(() =>
        expect(api.patch).toHaveBeenCalledWith(
          '/stores/store-1/settings',
          expect.objectContaining({ seoKeywords: ['handmade', 'dhaka'] }),
        ),
      );
    });

    it('shows an API failure on save', async () => {
      api.patch.mockRejectedValueOnce(
        new ApiError(400, 'VALIDATION', 'Validation failed', ['ogImageUrl must be an http(s) URL']),
      );
      const user = userEvent.setup();
      render(<SeoSettingsPage />);
      await user.click(await screen.findByLabelText('Allow search engines to index this store'));
      await user.click(screen.getByRole('button', { name: 'Save changes' }));
      await waitFor(() =>
        expect(pushToast).toHaveBeenCalledWith('ogImageUrl must be an http(s) URL', 'error'),
      );
    });
  });
});
