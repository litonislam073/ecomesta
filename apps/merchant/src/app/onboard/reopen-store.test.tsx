import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '@/lib/api-client';
import { cleanStoreSlugInput, isValidStoreSlug, suggestStoreSlug } from '@/lib/store-slug';
import { ReopenStoreForm } from './reopen-store-form';
import OnboardEntry from './onboard-entry';

const reloadProfile = vi.fn();
const refreshStores = vi.fn();
vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({ user: { id: 'u1', memberships: { stores: [] } }, loading: false, reloadProfile }),
}));
vi.mock('@/lib/store-context', () => ({ useStoreContext: () => ({ refreshStores }) }));
vi.mock('./onboard-form', () => ({ default: () => <p>Normal sign-up form</p> }));

const api = { get: vi.fn(), post: vi.fn() };
vi.mock('@/lib/api-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api-client')>('@/lib/api-client');
  return { ...actual, api: { get: (...a: unknown[]) => api.get(...a), post: (...a: unknown[]) => api.post(...a) } };
});

const business = { name: 'Rahim Traders', planName: 'Growth', planActive: true, awaitingPayment: false };

beforeEach(() => {
  api.get.mockReset();
  api.post.mockReset();
  reloadProfile.mockReset().mockResolvedValue(undefined);
  refreshStores.mockReset().mockResolvedValue(undefined);
  Object.defineProperty(window, 'location', { value: { ...window.location, assign: vi.fn() }, writable: true });
});

describe('store address suggestions', () => {
  it('runs the words of a name together', () => {
    expect(suggestStoreSlug('Amar Shop')).toBe('amarshop');
    expect(suggestStoreSlug('  Rahim & Sons Fashion BD ')).toBe('rahimsonsfashionbd');
    expect(suggestStoreSlug('Café 24')).toBe('cafe24');
    expect(suggestStoreSlug('আমার দোকান')).toBe('');
  });

  it('still lets a merchant type a hyphen', () => {
    expect(cleanStoreSlugInput('My Cool-Store!')).toBe('my-cool-store-');
    expect(isValidStoreSlug('my-cool-store')).toBe(true);
    expect(isValidStoreSlug('my--store')).toBe(false);
  });
});

describe('Reopening a store in the same business', () => {
  it('shows the normal sign-up form unless there is a business to reuse', async () => {
    api.get.mockResolvedValue({ success: true, data: null });
    render(<OnboardEntry />);
    expect(screen.getByText('Normal sign-up form')).toBeInTheDocument();
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/onboarding/existing-business'));
    expect(screen.getByText('Normal sign-up form')).toBeInTheDocument();
  });

  it('switches to the reopen form when the merchant has a business without a store', async () => {
    api.get.mockResolvedValue({ success: true, data: business });
    render(<OnboardEntry />);
    expect(await screen.findByRole('heading', { name: 'Open your new store' })).toBeInTheDocument();
    expect(screen.getByText(/Growth plan carries over, so there is nothing to pay/)).toBeInTheDocument();
  });

  it('suggests a compact address and creates the store without payment', async () => {
    const user = userEvent.setup();
    api.post.mockResolvedValue({ success: true, data: { store: { id: 's2' } } });
    render(<ReopenStoreForm business={business} />);
    await user.type(screen.getByLabelText('Store name'), 'Amar Shop');
    expect(screen.getByLabelText('Store address')).toHaveValue('amarshop');
    await user.click(screen.getByRole('button', { name: 'Create store' }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/onboarding/reopen-store', { storeName: 'Amar Shop', storeSlug: 'amarshop' }),
    );
    await waitFor(() => expect(window.location.assign).toHaveBeenCalledWith('/dashboard'));
    expect(reloadProfile).toHaveBeenCalled();
  });

  it('explains a taken address', async () => {
    const user = userEvent.setup();
    api.post.mockRejectedValue(new ApiError(409, 'CONFLICT', 'Store slug is already taken'));
    render(<ReopenStoreForm business={{ ...business, planActive: false, awaitingPayment: true }} />);
    expect(screen.getByText(/payment is still being checked/)).toBeInTheDocument();
    await user.type(screen.getByLabelText('Store name'), 'Taken');
    await user.click(screen.getByRole('button', { name: 'Create store' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('This store address is already taken');
  });
});
