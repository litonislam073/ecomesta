import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PaymentProviderConfigSafe, PlanLimits } from '@ecomesta/types';
import PaymentSettingsPage from '@/app/dashboard/settings/payments/page';

const pushToast = vi.fn();
let canManage = true;
let limits: PlanLimits | null = null;

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock('@/lib/store-context', () => ({
  useStoreContext: () => ({ selectedStoreId: 'store-1' }),
}));
vi.mock('@/lib/permissions', () => ({ useCanManageStore: () => canManage }));
vi.mock('@/components/ui/toast', () => ({ useToast: () => ({ pushToast }) }));
vi.mock('@/lib/subscription-context', () => ({
  useSubscription: () => ({ data: { subscription: { plan: { limits } } } }),
}));

const save = vi.fn();
let storeSettings: Record<string, unknown> = {};
vi.mock('@/lib/store-settings', async () => {
  const actual = await vi.importActual<typeof import('@/lib/store-settings')>('@/lib/store-settings');
  return {
    ...actual,
    useStoreSettings: () => ({
      storeId: 'store-1',
      settings: storeSettings,
      loading: false,
      error: null,
      saving: false,
      saveError: null,
      canEdit: true,
      reload: vi.fn(),
      save,
    }),
  };
});

const api = { get: vi.fn(), post: vi.fn() };
vi.mock('@/lib/api-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api-client')>('@/lib/api-client');
  return { ...actual, api: { get: (...a: unknown[]) => api.get(...a), post: (...a: unknown[]) => api.post(...a) } };
});

const row = (provider: string, over: Partial<PaymentProviderConfigSafe> = {}) =>
  ({ provider, enabled: false, mode: 'test', hasSecrets: false, implemented: true, publicConfig: null, ...over }) as PaymentProviderConfigSafe;

const ALL: PlanLimits = {
  maxProducts: null, storageMb: 5120, customDomain: true, onlinePayments: true, stripe: true, coupons: true, deliveryZones: true, allThemes: true, premiumThemes: true, marketingTracking: true,
};

describe('Payment providers settings', () => {
  beforeEach(() => {
    pushToast.mockReset();
    api.get.mockReset();
    api.post.mockReset();
    canManage = true;
    limits = ALL;
    save.mockReset();
    save.mockResolvedValue(true);
    storeSettings = {
      updatedAt: '2026-10-07T00:00:00.000Z',
      paymentCodEnabled: true,
      paymentBankTransferEnabled: true,
      paymentBankTransferDetails: null,
      paymentOtherEnabled: true,
      paymentOtherDetails: null,
    };
    api.get.mockResolvedValue({
      success: true,
      data: [row('TEST'), row('STRIPE'), row('SSL_COMMERZ', { enabled: true, mode: 'live', hasSecrets: true })],
    });
  });

  it('has a provider menu: one tab per provider, showing only the chosen one', async () => {
    const user = userEvent.setup();
    render(<PaymentSettingsPage />);
    const menu = await screen.findByRole('tablist', { name: 'Payment providers' });
    const tabs = within(menu).getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual(['৳Manual(active)', 'SSSLCommerz(active)', 'SStripe(off)', '</>Developer(off)']);
    expect(within(menu).getByRole('tab', { name: /Manual/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('heading', { name: 'Manual payments' })).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Stripe' })).toBeNull();

    await user.click(within(menu).getByRole('tab', { name: /Stripe/ }));
    expect(within(menu).getByRole('tab', { name: /Stripe/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('heading', { name: 'Stripe' })).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'SSLCommerz' })).toBeNull();

    // Arrow keys move between providers.
    await user.keyboard('{ArrowRight}');
    expect(within(menu).getByRole('tab', { name: /Developer/ })).toHaveAttribute('aria-selected', 'true');
    expect(within(menu).getByRole('tab', { name: /Developer/ })).toHaveFocus();
    expect(screen.getByRole('heading', { name: 'Developer: test payment provider' })).toBeVisible();
    await user.keyboard('{ArrowRight}');
    expect(within(menu).getByRole('tab', { name: /Manual/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('shows each provider as a card with its status in plain words', async () => {
    const user = userEvent.setup();
    render(<PaymentSettingsPage />);
    await user.click(await screen.findByRole('tab', { name: /SSLCommerz/ }));
    const ssl = screen.getByRole('heading', { name: 'SSLCommerz' }).closest('section')!;
    const status = within(ssl).getByLabelText('SSLCommerz status');
    expect(status).toHaveTextContent('Active');
    expect(status).toHaveTextContent('Live');
    expect(status).toHaveTextContent('Keys saved');
    expect(within(ssl).getByRole('switch', { name: /Accept payments with SSLCommerz/ })).toHaveAttribute('aria-checked', 'true');
    expect(within(ssl).getByText(/Live mode charges real money/)).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: /Stripe/ }));
    const stripe = screen.getByRole('heading', { name: 'Stripe' }).closest('section')!;
    expect(within(stripe).getByLabelText('Stripe status')).toHaveTextContent(/Off.*Test.*Keys not set/);
    expect(within(stripe).getByRole('button', { name: 'Test connection' })).toBeDisabled();
  });

  it('saves SSLCommerz with the switch and mode chosen, keeping stored keys when left blank', async () => {
    const user = userEvent.setup();
    api.post.mockResolvedValue({ success: true });
    render(<PaymentSettingsPage />);
    await user.click(await screen.findByRole('tab', { name: /SSLCommerz/ }));
    const ssl = screen.getByRole('heading', { name: 'SSLCommerz' }).closest('section')!;
    await user.click(within(ssl).getByRole('switch', { name: /Accept payments with SSLCommerz/ }));
    await user.click(within(ssl).getByRole('button', { name: 'Sandbox' }));
    expect(within(ssl).getByRole('button', { name: 'Sandbox' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(within(ssl).getByRole('button', { name: 'Save SSLCommerz' }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/stores/store-1/payment-providers', {
        provider: 'SSL_COMMERZ',
        enabled: false,
        mode: 'test',
        publicConfig: { label: 'SSLCommerz' },
      }),
    );
    expect(pushToast).toHaveBeenCalledWith('SSLCommerz provider saved', 'success');
  });

  it('still asks for both Stripe keys the first time', async () => {
    const user = userEvent.setup();
    render(<PaymentSettingsPage />);
    await user.click(await screen.findByRole('tab', { name: /Stripe/ }));
    const stripe = screen.getByRole('heading', { name: 'Stripe' }).closest('section')!;
    await user.type(within(stripe).getByLabelText('Secret key'), 'sk_test_123');
    await user.click(within(stripe).getByRole('button', { name: 'Save Stripe' }));
    expect(pushToast).toHaveBeenCalledWith('Stripe secret key and webhook secret are required', 'error');
    expect(api.post).not.toHaveBeenCalled();
  });

  it('tells a Starter store up front that online payments need another plan', async () => {
    limits = { ...ALL, onlinePayments: false, stripe: false };
    const user = userEvent.setup();
    render(<PaymentSettingsPage />);
    await user.click(await screen.findByRole('tab', { name: /SSLCommerz/ }));
    const ssl = screen.getByRole('heading', { name: 'SSLCommerz' }).closest('section')!;
    expect(within(ssl).getByRole('note')).toHaveTextContent('SSLCommerz is available on the Growth or Business plan.');
    expect(within(ssl).getByRole('link', { name: /Upgrade in Plan & billing/ })).toHaveAttribute('href', '/dashboard/billing');
    expect(within(ssl).getByRole('button', { name: 'Save SSLCommerz' })).toBeDisabled();
    await user.click(screen.getByRole('tab', { name: /Stripe/ }));
    const stripe = screen.getByRole('heading', { name: 'Stripe' }).closest('section')!;
    expect(within(stripe).getByRole('note')).toHaveTextContent('Stripe is available on the Business plan.');
  });

  it('Manual payments: Cash on delivery, bank transfer and other payment can each be switched off', async () => {
    const user = userEvent.setup();
    render(<PaymentSettingsPage />);
    const panel = (await screen.findByRole('heading', { name: 'Manual payments' })).closest('section')!;
    expect(within(panel).getByLabelText('Manual payments status')).toHaveTextContent('3 of 3 on');
    expect(within(panel).getByRole('button', { name: 'Save manual payments' })).toBeDisabled();
    await user.click(within(panel).getByRole('switch', { name: 'Bank transfer' }));
    await user.click(within(panel).getByRole('switch', { name: 'Other payment' }));
    expect(within(panel).getByLabelText('Manual payments status')).toHaveTextContent('1 of 3 on');
    await user.click(within(panel).getByRole('button', { name: 'Save manual payments' }));
    expect(save).toHaveBeenCalledWith(
      { paymentBankTransferEnabled: false, paymentOtherEnabled: false },
      'Manual payments saved',
    );
  });

  it('asks for bank details when bank transfer is on, and sends them', async () => {
    const user = userEvent.setup();
    render(<PaymentSettingsPage />);
    const panel = (await screen.findByRole('heading', { name: 'Manual payments' })).closest('section')!;
    expect(within(panel).getByText(/Add your bank details/)).toBeInTheDocument();
    await user.type(within(panel).getByLabelText('Bank details shown to customers'), 'DBBL 123456');
    expect(within(panel).queryByText(/Add your bank details/)).toBeNull();
    await user.click(within(panel).getByRole('button', { name: 'Save manual payments' }));
    expect(save).toHaveBeenCalledWith({ paymentBankTransferDetails: 'DBBL 123456' }, 'Manual payments saved');
  });

  it('never lets every way to pay be switched off', async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue({ success: true, data: [row('TEST'), row('STRIPE'), row('SSL_COMMERZ')] });
    render(<PaymentSettingsPage />);
    const panel = (await screen.findByRole('heading', { name: 'Manual payments' })).closest('section')!;
    for (const name of ['Cash on delivery', 'Bank transfer', 'Other payment']) {
      await user.click(within(panel).getByRole('switch', { name }));
    }
    expect(within(panel).getByRole('alert')).toHaveTextContent('Customers need at least one way to pay');
    expect(within(panel).getByRole('button', { name: 'Save manual payments' })).toBeDisabled();
    // With an online provider on, only Cash on delivery can go too.
    expect(save).not.toHaveBeenCalled();
  });

  it('is read-only without manager access', async () => {
    canManage = false;
    render(<PaymentSettingsPage />);
    expect(await screen.findByText('Read-only access')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Save/ })).toBeNull();
  });
});
