import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { StoreDomain, StoreDomainList } from '@ecomesta/types';
import DomainsPage from '@/app/dashboard/domains/page';
import { ApiError } from '@/lib/api-client';

const pushToast = vi.fn();
let canManage = true;

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

const subdomain: StoreDomain = {
  id: 'domain-sub',
  storeId: 'store-1',
  hostname: 'alpha.ecomesta.local',
  type: 'SUBDOMAIN',
  status: 'ACTIVE',
  isPrimary: true,
  verifiedAt: '2026-01-01T00:00:00.000Z',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  verificationConfigured: false,
  verification: null,
};

const pendingCustom: StoreDomain = {
  id: 'domain-custom',
  storeId: 'store-1',
  hostname: 'shop.example.com',
  type: 'CUSTOM_DOMAIN',
  status: 'PENDING',
  isPrimary: false,
  verifiedAt: null,
  createdAt: '2026-01-02T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
  verificationConfigured: true,
  verification: {
    recordType: 'TXT',
    recordName: '_ecomesta-verification.shop.example.com',
    recordValue: 'eco_token_value',
    verificationConfigured: true,
  },
};

function listPayload(items: StoreDomain[]): StoreDomainList {
  return {
    items,
    meta: {
      total: items.length,
      platformRootDomain: 'ecomesta.local',
      canonicalHostname: 'alpha.ecomesta.local',
    },
  };
}

function mockList(items: StoreDomain[] = [subdomain, pendingCustom]) {
  api.get.mockResolvedValue({ success: true, data: listPayload(items) });
}

describe('Domains dashboard', () => {
  beforeEach(() => {
    canManage = true;
    pushToast.mockReset();
    api.get.mockReset();
    api.post.mockReset();
    api.delete.mockReset();
  });

  it('lists domains with type, status, primary badge and verified date', async () => {
    mockList();
    render(<DomainsPage />);

    expect(
      await screen.findByRole('heading', { name: 'Domains' }),
    ).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith('/stores/store-1/domains');

    const rows = within(
      screen.getByRole('list', { name: 'Store domains' }),
    ).getAllByRole('listitem');
    expect(rows).toHaveLength(2);

    expect(within(rows[0]!).getByText('alpha.ecomesta.local')).toBeInTheDocument();
    expect(within(rows[0]!).getByText('Primary')).toBeInTheDocument();
    expect(within(rows[0]!).getByText('Active')).toBeInTheDocument();
    expect(
      within(rows[0]!).getByText(/platform subdomain · verified 2026-01-01/i),
    ).toBeInTheDocument();

    expect(
      within(rows[1]!).getByText('shop.example.com', { selector: 'span' }),
    ).toBeInTheDocument();
    expect(within(rows[1]!).getByText('Pending')).toBeInTheDocument();
    expect(
      within(rows[1]!).getByText(/custom domain · not verified/i),
    ).toBeInTheDocument();
    expect(within(rows[1]!).queryByText('Primary')).not.toBeInTheDocument();

    expect(screen.getByText('alpha.ecomesta.local', { selector: 'code' }));
  });

  it('adds a custom domain and reloads the list', async () => {
    mockList([subdomain]);
    api.post.mockResolvedValue({ success: true, data: pendingCustom });
    const user = userEvent.setup();
    render(<DomainsPage />);

    const input = await screen.findByLabelText('Hostname');
    await user.type(input, 'https://Shop.Example.com/');
    await user.click(screen.getByRole('button', { name: 'Add domain' }));

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/stores/store-1/domains', {
        hostname: 'https://Shop.Example.com/',
      }),
    );
    expect(pushToast).toHaveBeenCalledWith(
      'Domain added — copy the DNS token now (shown once)',
      'success',
    );
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
  });

  it('reports add failures without clearing the field', async () => {
    mockList([subdomain]);
    api.post.mockRejectedValue(
      new ApiError(409, 'CONFLICT', 'This hostname is already in use'),
    );
    const user = userEvent.setup();
    render(<DomainsPage />);

    const input = await screen.findByLabelText('Hostname');
    await user.type(input, 'shop.example.com');
    await user.click(screen.getByRole('button', { name: 'Add domain' }));

    await waitFor(() =>
      expect(pushToast).toHaveBeenCalledWith(
        'This hostname is already in use',
        'error',
      ),
    );
    expect(input).toHaveValue('shop.example.com');
  });

  it('shows the TXT verification instructions with copy buttons', async () => {
    mockList();
    const user = userEvent.setup();
    render(<DomainsPage />);

    const instructions = await screen.findByRole('region', {
      name: 'DNS verification for shop.example.com',
    });
    expect(within(instructions).getByText('TXT')).toBeInTheDocument();
    expect(
      within(instructions).getByText('_ecomesta-verification'),
    ).toBeInTheDocument();
    expect(
      within(instructions).getByText('_ecomesta-verification.shop.example.com'),
    ).toBeInTheDocument();
    expect(within(instructions).getByText('eco_token_value')).toBeInTheDocument();

    await user.click(
      within(instructions).getByRole('button', { name: 'Copy Value' }),
    );
    await expect(navigator.clipboard.readText()).resolves.toBe('eco_token_value');
  });

  it('runs verify and refreshes the row after a failed check', async () => {
    mockList();
    api.post.mockRejectedValue(
      new ApiError(
        422,
        'DOMAIN_VERIFICATION_FAILED',
        'No matching TXT record found at _ecomesta-verification.shop.example.com',
      ),
    );
    const user = userEvent.setup();
    render(<DomainsPage />);

    await user.click(await screen.findByRole('button', { name: 'Verify' }));

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(
        '/stores/store-1/domains/domain-custom/verify',
      ),
    );
    expect(pushToast).toHaveBeenCalledWith(
      'No matching TXT record found at _ecomesta-verification.shop.example.com',
      'error',
    );
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
  });

  it('activates a verified domain and promotes an active one to primary', async () => {
    const verified: StoreDomain = {
      ...pendingCustom,
      status: 'VERIFIED',
      verifiedAt: '2026-01-03T00:00:00.000Z',
    };
    const active: StoreDomain = {
      ...verified,
      status: 'ACTIVE',
      verification: null,
      verificationConfigured: false,
    };
    api.get
      .mockResolvedValueOnce({ success: true, data: listPayload([subdomain, verified]) })
      .mockResolvedValue({ success: true, data: listPayload([subdomain, active]) });
    api.post.mockResolvedValue({ success: true, data: active });
    const user = userEvent.setup();
    render(<DomainsPage />);

    await user.click(await screen.findByRole('button', { name: 'Activate' }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(
        '/stores/store-1/domains/domain-custom/activate',
      ),
    );
    expect(pushToast).toHaveBeenCalledWith('Domain activated', 'success');

    const setPrimary = await screen.findAllByRole('button', {
      name: 'Set primary',
    });
    await user.click(setPrimary[0]!);
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(
        '/stores/store-1/domains/domain-custom/set-primary',
      ),
    );
  });

  it('deletes only after the confirmation dialog is accepted', async () => {
    mockList();
    api.delete.mockResolvedValue({
      success: true,
      data: { id: 'domain-custom', hostname: 'shop.example.com' },
    });
    const user = userEvent.setup();
    render(<DomainsPage />);

    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    const dialog = screen.getByRole('dialog', { name: /delete this domain/i });
    expect(dialog).toHaveTextContent('shop.example.com');
    expect(api.delete).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(api.delete).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await user.click(screen.getByRole('button', { name: 'Delete domain' }));
    await waitFor(() =>
      expect(api.delete).toHaveBeenCalledWith(
        '/stores/store-1/domains/domain-custom',
      ),
    );
    expect(pushToast).toHaveBeenCalledWith('Domain deleted', 'success');
  });

  it('confirms before disabling a domain', async () => {
    mockList([
      subdomain,
      {
        ...pendingCustom,
        status: 'ACTIVE',
        verification: null,
        verificationConfigured: false,
      },
    ]);
    api.post.mockResolvedValue({ success: true, data: pendingCustom });
    const user = userEvent.setup();
    render(<DomainsPage />);

    await user.click(await screen.findByRole('button', { name: 'Disable' }));
    expect(
      screen.getByRole('dialog', { name: /disable this domain/i }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Disable domain' }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(
        '/stores/store-1/domains/domain-custom/disable',
      ),
    );
  });

  it('is read-only for staff without manage access', async () => {
    canManage = false;
    mockList();
    render(<DomainsPage />);

    expect(
      await screen.findByText(/read-only access to this store/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('form', { name: 'Add custom domain' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Hostname')).not.toBeInTheDocument();
    for (const label of ['Verify', 'Activate', 'Set primary', 'Disable', 'Delete']) {
      expect(screen.queryByRole('button', { name: label })).not.toBeInTheDocument();
    }
    // Instructions stay visible so staff can hand the record to an admin.
    expect(
      screen.getByRole('region', { name: 'DNS verification for shop.example.com' }),
    ).toBeInTheDocument();
  });

  it('surfaces load failures with a retry', async () => {
    api.get.mockRejectedValue(new ApiError(403, 'FORBIDDEN', 'No access'));
    render(<DomainsPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('No access');
    expect(
      screen.getByRole('button', { name: /try again/i }),
    ).toBeInTheDocument();
  });
});
