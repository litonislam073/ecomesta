import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminStoresPage from '@/app/dashboard/stores/page';
import AdminStoreDetailPage from '@/app/dashboard/stores/[storeId]/page';
import { ApiError } from '@/lib/api-client';

const pushToast = vi.fn();
const push = vi.fn();

vi.mock('next/navigation', () => ({
  useParams: () => ({ storeId: 'store-1' }),
  useRouter: () => ({ push, replace: vi.fn() }),
}));

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
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

const tenant = {
  id: 'tenant-1',
  name: 'Alpha Group',
  slug: 'alpha',
  status: 'ACTIVE' as const,
};

const sampleStore = {
  id: 'store-1',
  name: 'Alpha Store',
  slug: 'alpha-store',
  status: 'ACTIVE' as const,
  currency: 'USD',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  tenant,
};

const sampleDetail = {
  ...sampleStore,
  description: null,
  timezone: 'UTC',
  locale: 'en-US',
  memberships: [],
  domains: [
    {
      id: 'domain-1',
      hostname: 'alpha.ecomesta.local',
      type: 'SUBDOMAIN',
      status: 'ACTIVE',
      isPrimary: true,
      verifiedAt: null,
    },
  ],
  theme: {
    name: 'Default',
    slug: 'default',
    publishedAt: '2026-02-01T00:00:00.000Z',
  },
  counts: { products: 20, customers: 8, orders: 14, inventoryItems: 25 },
};

describe('Admin stores', () => {
  beforeEach(() => {
    pushToast.mockReset();
    api.get.mockReset();
    api.patch.mockReset();
  });

  it('lists stores with their owning tenant', async () => {
    api.get.mockResolvedValue({
      success: true,
      data: {
        items: [sampleStore],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      },
    });
    render(<AdminStoresPage />);

    expect(await screen.findByRole('link', { name: 'Alpha Store' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Alpha Group' })).toBeInTheDocument();
    expect(screen.getByText('USD')).toBeInTheDocument();
  });

  it('filters by status', async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue({
      success: true,
      data: {
        items: [sampleStore],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      },
    });
    render(<AdminStoresPage />);
    await screen.findByRole('link', { name: 'Alpha Store' });

    await user.selectOptions(screen.getByLabelText('Status filter'), 'SUSPENDED');

    await waitFor(() => {
      const paths = api.get.mock.calls.map((call) => String(call[0]));
      expect(paths.some((path) => path.includes('status=SUSPENDED'))).toBe(true);
    });
  });

  it('surfaces API errors', async () => {
    api.get.mockRejectedValue(new ApiError(403, 'FORBIDDEN', 'Nope'));
    render(<AdminStoresPage />);

    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  it('confirms before suspending a store', async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue({ success: true, data: sampleDetail });
    api.patch.mockResolvedValue({ success: true, data: sampleDetail });
    render(<AdminStoreDetailPage />);

    await user.click(await screen.findByRole('button', { name: /suspend store/i }));

    expect(screen.getByRole('dialog')).toHaveTextContent('Suspend this store?');
    expect(api.patch).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /update status/i }));

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith('/admin/stores/store-1/status', {
        status: 'SUSPENDED',
      });
    });
    expect(pushToast).toHaveBeenCalledWith('Store suspended', 'success');
  });

  it('shows catalog counts and domains on the detail page', async () => {
    api.get.mockResolvedValue({ success: true, data: sampleDetail });
    render(<AdminStoreDetailPage />);

    expect(await screen.findByText('alpha.ecomesta.local')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
    expect(screen.getByText('25')).toBeInTheDocument();
  });

  it('never renders a DNS verification token, even if the API returns one', async () => {
    api.get.mockResolvedValue({
      success: true,
      data: {
        ...sampleDetail,
        domains: [
          {
            ...sampleDetail.domains[0],
            id: 'domain-2',
            hostname: 'shop.example.com',
            type: 'CUSTOM_DOMAIN',
            status: 'PENDING',
            isPrimary: false,
            verificationToken: 'eco_secret_token',
            verification: {
              recordType: 'TXT',
              recordName: '_ecomesta-verification.shop.example.com',
              recordValue: 'eco_secret_token',
            },
          },
        ],
      },
    });
    render(<AdminStoreDetailPage />);

    expect(await screen.findByText('shop.example.com')).toBeInTheDocument();
    expect(screen.queryByText(/eco_secret_token/)).not.toBeInTheDocument();
    expect(screen.queryByText(/_ecomesta-verification/)).not.toBeInTheDocument();
    expect(
      screen.getByText(/never exposed here/i),
    ).toBeInTheDocument();
  });

  it('shows the active storefront theme on the detail page', async () => {
    api.get.mockResolvedValue({ success: true, data: sampleDetail });
    render(<AdminStoreDetailPage />);

    expect(await screen.findByText('Default')).toBeInTheDocument();
  });

  describe('deleting a store', () => {
    beforeEach(() => {
      api.post.mockReset();
      push.mockReset();
    });

    it('soft-deletes with an optional reason after confirmation', async () => {
      const user = userEvent.setup();
      api.get.mockResolvedValue({ success: true, data: sampleDetail });
      api.post.mockResolvedValue({ success: true, data: {} });
      render(<AdminStoreDetailPage />);

      await user.click(await screen.findByRole('button', { name: 'Delete store' }));
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveTextContent('Delete this store?');
      await user.type(within(dialog).getByLabelText(/Reason/), 'Opened by mistake');
      await user.click(within(dialog).getByRole('button', { name: 'Delete store' }));

      await waitFor(() =>
        expect(api.post).toHaveBeenCalledWith('/admin/stores/store-1/soft-delete', { reason: 'Opened by mistake' }),
      );
      expect(pushToast).toHaveBeenCalledWith('Store deleted. It can be restored from this page.', 'success');
    });

    it('shows a deleted store and restores it on a new address', async () => {
      const user = userEvent.setup();
      api.get.mockResolvedValue({
        success: true,
        data: { ...sampleDetail, slug: 'deleted--store-1', status: 'SUSPENDED', deletedAt: '2026-10-30T00:00:00.000Z', deletedSlug: 'alpha-store' },
      });
      api.post.mockResolvedValue({ success: true, data: {} });
      render(<AdminStoreDetailPage />);

      expect(await screen.findByText('This store is deleted.')).toBeInTheDocument();
      // The status controls are hidden for a deleted store.
      expect(screen.queryByRole('button', { name: /suspend store|activate store/i })).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Restore store' }));
      const dialog = screen.getByRole('dialog');
      const address = within(dialog).getByLabelText('Store address');
      expect(address).toHaveValue('alpha-store');
      await user.clear(address);
      await user.type(address, 'alpha-two');
      await user.click(within(dialog).getByRole('button', { name: 'Restore store' }));
      await waitFor(() => expect(api.post).toHaveBeenCalledWith('/admin/stores/store-1/restore', { slug: 'alpha-two' }));
    });

    it('needs the store address typed before deleting permanently', async () => {
      const user = userEvent.setup();
      api.get.mockResolvedValue({ success: true, data: sampleDetail });
      api.post.mockResolvedValue({ success: true, data: { deleted: true } });
      render(<AdminStoreDetailPage />);

      await user.click(await screen.findByRole('button', { name: 'Delete permanently' }));
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveTextContent('20 products, 14 orders and 8 customers');
      const confirm = within(dialog).getByRole('button', { name: 'Delete permanently' });
      expect(confirm).toBeDisabled();
      await user.type(within(dialog).getByLabelText(/to confirm/), 'alpha-stor');
      expect(confirm).toBeDisabled();
      await user.type(within(dialog).getByLabelText(/to confirm/), 'e');
      expect(confirm).toBeEnabled();
      await user.click(confirm);

      await waitFor(() =>
        expect(api.post).toHaveBeenCalledWith('/admin/stores/store-1/permanent-delete', { confirmSlug: 'alpha-store' }),
      );
      expect(push).toHaveBeenCalledWith('/dashboard/stores');
    });

    it('marks deleted stores in the list and filters them', async () => {
      const user = userEvent.setup();
      api.get.mockResolvedValue({
        success: true,
        data: {
          items: [{ ...sampleStore, slug: 'deleted--store-1', deletedAt: '2026-10-30T00:00:00.000Z', deletedSlug: 'alpha-store' }],
          meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
        },
      });
      render(<AdminStoresPage />);
      expect(await screen.findByText('Deleted')).toBeInTheDocument();
      expect(screen.getByText(/was alpha-store/)).toBeInTheDocument();
      await user.selectOptions(screen.getByLabelText('Deleted filter'), 'deleted');
      await waitFor(() => expect(api.get).toHaveBeenLastCalledWith(expect.stringContaining('deleted=deleted')));
    });
  });
});
