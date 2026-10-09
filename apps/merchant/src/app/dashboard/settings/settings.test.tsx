import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
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
import TrackingSettingsPage from '@/app/dashboard/tracking/page';
import DangerZoneSettingsPage from '@/app/dashboard/settings/danger-zone/page';
import { SidebarNav } from '@/components/dashboard/sidebar-nav';
import { ApiError } from '@/lib/api-client';
import { DASHBOARD_NAV, SETTINGS_NAV } from '@/lib/nav';

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
  paymentCodEnabled: true,
  paymentBankTransferEnabled: true,
  paymentBankTransferDetails: null,
  paymentOtherEnabled: true,
  paymentOtherDetails: null,
  allowCustomerCancellation: false,
  seoTitle: 'Alpha handmade goods',
  seoDescription: null,
  seoKeywords: ['handmade'],
  ogTitle: null,
  ogDescription: null,
  ogImageUrl: null,
  seoIndexingEnabled: true,
  metaPixelId: null,
  gtmContainerId: null,
  ga4MeasurementId: null,
  googleSiteVerification: null,
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

/**
 * The form first renders with an empty draft and fills it from the loaded
 * settings in an effect; flush that effect so typing is never overwritten.
 */
async function findLoaded(label: string): Promise<HTMLElement> {
  const field = await screen.findByLabelText(label);
  await act(async () => {});
  return field;
}

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
      expect(screen.getByRole('link', { name: 'Theme New' })).toHaveAttribute(
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

      const name = await findLoaded('Store name');
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
      await user.clear(await findLoaded('Store name'));
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
      await user.type(await findLoaded('Description'), ' and more');
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
      expect(await findLoaded('Store name')).toBeDisabled();
      expect(screen.getByRole('note')).toHaveTextContent(/read-only access/i);
      expect(screen.queryByRole('button', { name: 'Save changes' })).toBeNull();
    });
  });

  describe('store details', () => {
    it('validates email and phone before saving', async () => {
      const user = userEvent.setup();
      render(<StoreDetailsSettingsPage />);
      const email = await findLoaded('Support email');
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
      const phone = await findLoaded('Support phone');
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
    it('saves the order notes toggle and shows phone required, email optional', async () => {
      api.patch.mockResolvedValue({
        success: true,
        data: { ...baseSettings, checkoutAllowOrderNotes: false },
      });
      const user = userEvent.setup();
      render(<CheckoutSettingsPage />);
      await user.click(await findLoaded('Allow order notes'));
      await user.click(screen.getByRole('button', { name: 'Save changes' }));
      await waitFor(() =>
        expect(api.patch).toHaveBeenCalledWith('/stores/store-1/settings', {
          checkoutAllowOrderNotes: false,
          expectedUpdatedAt: baseSettings.updatedAt,
        }),
      );
      // The phone requirement is a platform rule now, not a store toggle.
      expect(screen.queryByLabelText('Require a phone number')).toBeNull();
      const row = (label: string) => screen.getByText(label, { selector: 'dt' }).parentElement!;
      expect(row('Phone number')).toHaveTextContent('Required');
      expect(row('Email address')).toHaveTextContent('Optional');
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
      await user.click(await findLoaded('Let customers cancel their own orders'));
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
      expect(await findLoaded('Allow order notes')).toBeDisabled();
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
        screen.getByText(/Order emails for you and your customers are not available yet/),
      ).toBeInTheDocument();
      expect(screen.getByText(/password reset links and password changes/)).toBeInTheDocument();
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
      const title = await findLoaded('Page title');
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
      await user.type(await findLoaded('Share image URL'), 'javascript:alert(1)');
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
      const keywords = await findLoaded('Keywords');
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
      await user.click(await findLoaded('Allow search engines to index this store'));
      await user.click(screen.getByRole('button', { name: 'Save changes' }));
      await waitFor(() =>
        expect(pushToast).toHaveBeenCalledWith('ogImageUrl must be an http(s) URL', 'error'),
      );
    });
  });

  describe('Marketing & tracking', () => {
    it('saves Pixel, Tag Manager and Analytics IDs and the Search Console code from a pasted tag', async () => {
      api.patch.mockResolvedValue({ success: true, data: baseSettings });
      const user = userEvent.setup();
      render(<TrackingSettingsPage />);
      await user.type(await findLoaded('Pixel ID'), '123456789012345');
      await user.type(screen.getByLabelText('Container ID'), 'GTM-ABC1234');
      await user.type(screen.getByLabelText('Measurement ID'), 'G-ABC123XYZ9');
      const tag = screen.getByLabelText('Verification tag');
      await user.click(tag);
      await user.paste('<meta name="google-site-verification" content="AbC-123_xyzVerificationCode" />');
      expect(screen.getByText('Code found: AbC-123_xyzVerificationCode')).toBeInTheDocument();
      // The store address to verify, from the store's domains.
      expect(screen.getByText('https://shop.alpha.com/')).toBeInTheDocument();
      expect(screen.getAllByText('Not set up')).toHaveLength(4);

      await user.click(screen.getByRole('button', { name: 'Save changes' }));
      await waitFor(() =>
        expect(api.patch).toHaveBeenCalledWith(
          '/stores/store-1/settings',
          expect.objectContaining({
            metaPixelId: '123456789012345',
            gtmContainerId: 'GTM-ABC1234',
            ga4MeasurementId: 'G-ABC123XYZ9',
            googleSiteVerification: '<meta name="google-site-verification" content="AbC-123_xyzVerificationCode" />',
          }),
        ),
      );
    });

    it('refuses scripts and wrong IDs before saving', async () => {
      const user = userEvent.setup();
      render(<TrackingSettingsPage />);
      await user.type(await findLoaded('Pixel ID'), '<script>');
      expect(screen.getByText(/The Pixel ID is a number/)).toBeInTheDocument();
      await user.type(screen.getByLabelText('Measurement ID'), 'UA-1234-1');
      expect(screen.getByText(/Use the measurement ID that starts with G-/)).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Save changes' }));
      expect(api.patch).not.toHaveBeenCalled();
    });

    it('shows what is connected and the events the store sends', async () => {
      mockLoad({ ...baseSettings, metaPixelId: '123456789012345', ga4MeasurementId: 'G-ABC123XYZ9' });
      render(<TrackingSettingsPage />);
      await findLoaded('Pixel ID');
      expect(screen.getAllByText('Connected')).toHaveLength(2);
      for (const event of ['PageView', 'ViewContent', 'AddToCart', 'InitiateCheckout', 'Purchase', 'purchase']) {
        expect(screen.getByText(event)).toBeInTheDocument();
      }
    });

    it('shows how many tags are connected, and removes one', async () => {
      mockLoad({ ...baseSettings, metaPixelId: '123456789012345' });
      api.patch.mockResolvedValue({ success: true, data: baseSettings });
      const user = userEvent.setup();
      render(<TrackingSettingsPage />);
      await findLoaded('Pixel ID');
      expect(screen.getByText('1 of 4 connected')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Remove Facebook (Meta) Pixel' }));
      expect(screen.getByLabelText('Pixel ID')).toHaveValue('');
      await user.click(screen.getByRole('button', { name: 'Save changes' }));
      await waitFor(() =>
        expect(api.patch).toHaveBeenCalledWith('/stores/store-1/settings', expect.objectContaining({ metaPixelId: '' })),
      );
    });

    it('explains where to find each ID, with a link to the tool', async () => {
      render(<TrackingSettingsPage />);
      await findLoaded('Pixel ID');
      const pixel = screen.getByRole('region', { name: 'Facebook (Meta) Pixel' });
      expect(within(pixel).getByText(/Where do I find it\?/)).toBeInTheDocument();
      expect(within(pixel).getByRole('link', { name: /Open Events Manager/ })).toHaveAttribute(
        'href',
        'https://business.facebook.com/events_manager2',
      );
      const console = screen.getByRole('region', { name: 'Google Search Console' });
      expect(within(console).getByRole('button', { name: 'Copy' })).toBeInTheDocument();
    });

    it('lives in the Marketing menu, not in Settings', () => {
      const marketing = DASHBOARD_NAV.find((section) => section.title === 'Marketing')!;
      expect(marketing.items.map((item) => item.label)).toEqual(['Coupons', 'Marketing & tracking', 'Landing page']);
      expect(marketing.items[1]!.href).toBe('/dashboard/tracking');
      expect(SETTINGS_NAV.some((item) => item.href.includes('tracking'))).toBe(false);
    });
  });
});
