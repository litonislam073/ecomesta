import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { PlanLimits } from '@ecomesta/types';
import TrackingSettingsPage from '@/app/dashboard/settings/tracking/page';

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard/settings/tracking',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

const BASE: PlanLimits = {
  maxProducts: 25,
  storageMb: 1024,
  customDomain: false,
  onlinePayments: false,
  stripe: false,
  coupons: false,
  deliveryZones: false,
  allThemes: false,
  premiumThemes: false,
  marketingTracking: false,
};
let limits: PlanLimits = BASE;
vi.mock('@/lib/subscription-context', () => ({
  useSubscription: () => ({ data: { subscription: { plan: { limits } } } }),
}));

const save = vi.fn();
let settings: Record<string, unknown> = {};
vi.mock('@/lib/store-settings', async () => {
  const actual = await vi.importActual<typeof import('@/lib/store-settings')>('@/lib/store-settings');
  return {
    ...actual,
    useStoreSettings: () => ({ storeId: 'store-1', settings, loading: false, error: null, reload: vi.fn(), save, saving: false, canEdit: true }),
    useStoreSettingsSummary: () => ({ summary: null }),
  };
});

const tracking = (over: Record<string, string | null> = {}) => ({
  slug: 'alpha',
  metaPixelId: null,
  gtmContainerId: null,
  ga4MeasurementId: null,
  googleSiteVerification: null,
  updatedAt: '2026-10-09T00:00:00.000Z',
  ...over,
});

describe('Marketing & tracking by plan', () => {
  beforeEach(() => {
    save.mockReset();
    settings = tracking();
  });

  it('Starter: explains it is a Growth/Business feature and locks the fields', () => {
    limits = BASE;
    render(<TrackingSettingsPage />);
    expect(screen.getByRole('status')).toHaveTextContent('available on the Growth and Business plans');
    expect(screen.getByRole('link', { name: /Upgrade in Plan & billing/ })).toHaveAttribute('href', '/dashboard/billing');
    for (const label of ['Pixel ID', 'Container ID', 'Measurement ID', 'Verification tag']) {
      expect(screen.getByLabelText(label)).toBeDisabled();
    }
    expect(screen.queryByRole('button', { name: 'Save changes' })).toBeNull();
  });

  it('Starter after a downgrade: saved IDs are kept but not used', () => {
    limits = BASE;
    settings = tracking({ metaPixelId: '123456789012345' });
    render(<TrackingSettingsPage />);
    expect(screen.getByRole('status')).toHaveTextContent('Your saved IDs are kept but not used on your store until you upgrade.');
    expect(screen.getByText('Paused (upgrade)')).toBeInTheDocument();
    expect(screen.queryByText('Connected')).toBeNull();
  });

  it.each(['Growth', 'Business'])('%s: editable', () => {
    limits = { ...BASE, marketingTracking: true };
    render(<TrackingSettingsPage />);
    expect(screen.queryByText(/available on the Growth and Business plans/)).toBeNull();
    expect(screen.getByLabelText('Pixel ID')).toBeEnabled();
  });
});
