import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Category } from '@ecomesta/types';
import { DemoCatalogCta } from '@/components/catalog/demo-catalog-cta';
import { CategoryTree } from '@/components/catalog/category-tree';
import { ApiError } from '@/lib/api-client';

const pushToast = vi.fn();
const api = { get: vi.fn(), post: vi.fn() };

vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ pushToast }),
}));

vi.mock('@/lib/api-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api-client')>(
    '@/lib/api-client',
  );
  return {
    ...actual,
    api: {
      get: (...args: unknown[]) => api.get(...args),
      post: (...args: unknown[]) => api.post(...args),
    },
  };
});

function statusResponse(available: boolean, imported = false, hasRealProducts = false) {
  return { success: true, data: { available, imported, hasRealProducts } };
}

const importResult = {
  success: true,
  data: { categories: 5, products: 9, variants: 6, inventoryItems: 13 },
};

async function openConfirm() {
  const user = userEvent.setup();
  await user.click(
    await screen.findByRole('button', { name: 'Import Demo Products' }),
  );
  return user;
}

describe('DemoCatalogCta', () => {
  beforeEach(() => {
    pushToast.mockReset();
    api.get.mockReset();
    api.post.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it('shows the CTA for a new empty store', async () => {
    api.get.mockResolvedValue(statusResponse(true));
    render(<DemoCatalogCta storeId="store-1" canWrite />);

    expect(await screen.findByText('Sample Store Products')).toBeInTheDocument();
    expect(
      screen.getByText('Want to preview your storefront with sample products?'),
    ).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith('/stores/store-1/demo-catalog/status');
  });

  it('stays hidden when the backend says import is unavailable', async () => {
    api.get.mockResolvedValue(statusResponse(false, true));
    render(<DemoCatalogCta storeId="store-1" canWrite />);

    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(screen.queryByText('Sample Store Products')).not.toBeInTheDocument();
  });

  it('stays hidden after a real product exists', async () => {
    api.get.mockResolvedValue(statusResponse(false, false, true));
    render(<DemoCatalogCta storeId="store-1" canWrite />);

    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(
      screen.queryByRole('button', { name: 'Import Demo Products' }),
    ).not.toBeInTheDocument();
  });

  it('stays hidden for users who cannot manage the store', async () => {
    api.get.mockResolvedValue(statusResponse(true));
    render(<DemoCatalogCta storeId="store-1" canWrite={false} />);

    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(screen.queryByText('Sample Store Products')).not.toBeInTheDocument();
  });

  it('asks for confirmation and cancel does not import', async () => {
    api.get.mockResolvedValue(statusResponse(true));
    render(<DemoCatalogCta storeId="store-1" canWrite />);

    const user = await openConfirm();
    expect(
      screen.getByRole('dialog', { name: 'Add sample products to your store?' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('shows loading, then success, refreshes the list, and hides the CTA', async () => {
    api.get.mockResolvedValue(statusResponse(true));
    let resolveImport: (value: unknown) => void = () => undefined;
    api.post.mockReturnValue(
      new Promise((resolve) => {
        resolveImport = resolve;
      }),
    );
    const onImported = vi.fn();
    render(<DemoCatalogCta storeId="store-1" canWrite onImported={onImported} />);

    const user = await openConfirm();
    const dialog = screen.getByRole('dialog');
    await user.click(
      dialog.querySelector('button:last-of-type') as HTMLButtonElement,
    );

    const loadingButton = await screen.findByRole('button', {
      name: 'Importing sample products…',
    });
    expect(loadingButton).toBeDisabled();

    resolveImport(importResult);

    await waitFor(() => {
      expect(pushToast).toHaveBeenCalledWith(
        'Sample products added successfully.',
        'success',
      );
    });
    expect(onImported).toHaveBeenCalledTimes(1);
    expect(api.post).toHaveBeenCalledWith('/stores/store-1/demo-catalog/import');
    expect(screen.queryByText('Sample Store Products')).not.toBeInTheDocument();
  });

  it('shows import progress that follows the real request and refresh', async () => {
    api.get.mockResolvedValue(statusResponse(true));
    let resolveImport: (value: unknown) => void = () => undefined;
    api.post.mockReturnValue(
      new Promise((resolve) => {
        resolveImport = resolve;
      }),
    );
    let finishRefresh: () => void = () => undefined;
    const onImported = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishRefresh = resolve;
        }),
    );
    render(<DemoCatalogCta storeId="store-1" canWrite onImported={onImported} />);

    const user = await openConfirm();
    await user.click(
      screen.getByRole('dialog').querySelector('button:last-of-type') as HTMLButtonElement,
    );

    const steps = () =>
      screen
        .getAllByRole('listitem')
        .map((item) => item.textContent);
    expect(
      await screen.findByRole('heading', { name: 'Setting up your demo store' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("We're adding a few sample products so you can explore your store."),
    ).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Importing demo catalog...');
    expect(steps()).toEqual([
      'Store created (completed)',
      expect.stringContaining('Importing demo catalog (in progress)'),
      'Finalizing your catalog (pending)',
    ]);
    expect(onImported).not.toHaveBeenCalled();

    resolveImport(importResult);
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        'Demo catalog imported. Finalizing your catalog...',
      ),
    );
    expect(steps()[1]).toContain('(completed)');
    expect(steps()[2]).toContain('(in progress)');
    expect(pushToast).not.toHaveBeenCalled();

    finishRefresh();
    await waitFor(() =>
      expect(pushToast).toHaveBeenCalledWith('Sample products added successfully.', 'success'),
    );
    expect(screen.queryByRole('heading', { name: 'Setting up your demo store' })).toBeNull();
  });

  it('reports a committed import as successful even if the page refresh fails', async () => {
    api.get.mockResolvedValue(statusResponse(true));
    api.post.mockResolvedValue(importResult);
    const onImported = vi.fn().mockRejectedValue(new Error('refresh failed'));
    render(<DemoCatalogCta storeId="store-1" canWrite onImported={onImported} />);

    const user = await openConfirm();
    await user.click(
      screen.getByRole('dialog').querySelector('button:last-of-type') as HTMLButtonElement,
    );

    await waitFor(() =>
      expect(pushToast).toHaveBeenCalledWith('Sample products added successfully.', 'success'),
    );
    expect(screen.queryByRole('alert')).toBeNull();
    expect(api.post).toHaveBeenCalledTimes(1);
  });

  it('does not send duplicate imports on rapid double-click', async () => {
    api.get.mockResolvedValue(statusResponse(true));
    api.post.mockResolvedValue(importResult);
    render(<DemoCatalogCta storeId="store-1" canWrite />);

    const user = await openConfirm();
    const confirm = screen
      .getByRole('dialog')
      .querySelector('button:last-of-type') as HTMLButtonElement;
    await user.dblClick(confirm);

    await waitFor(() => expect(pushToast).toHaveBeenCalled());
    expect(api.post).toHaveBeenCalledTimes(1);
  });

  it('shows the already-imported message on 409 and hides the CTA', async () => {
    api.get
      .mockResolvedValueOnce(statusResponse(true))
      .mockResolvedValue(statusResponse(false, true));
    api.post.mockRejectedValue(
      new ApiError(409, 'CONFLICT', 'Sample products have already been added to this store'),
    );
    render(<DemoCatalogCta storeId="store-1" canWrite />);

    const user = await openConfirm();
    await user.click(
      screen.getByRole('dialog').querySelector('button:last-of-type') as HTMLButtonElement,
    );

    await waitFor(() => {
      expect(pushToast).toHaveBeenCalledWith(
        'Sample products have already been added to this store.',
        'error',
      );
    });
    expect(screen.queryByText('Sample Store Products')).not.toBeInTheDocument();
  });

  it('shows a safe error on server failure without leaking details', async () => {
    api.get.mockResolvedValue(statusResponse(true));
    api.post.mockRejectedValue(
      new ApiError(500, 'INTERNAL', 'PrismaClientKnownRequestError: relation "products"'),
    );
    render(<DemoCatalogCta storeId="store-1" canWrite />);

    const user = await openConfirm();
    await user.click(
      screen.getByRole('dialog').querySelector('button:last-of-type') as HTMLButtonElement,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not import sample products. Please try again.',
    );
    expect(screen.queryByText(/Prisma/)).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Import Demo Products' }),
    ).toBeEnabled();
  });
});

describe('CategoryTree sample badge', () => {
  afterEach(() => {
    cleanup();
  });

  it('marks demo categories as Sample and leaves real ones unmarked', () => {
    const base = {
      storeId: 'store-1',
      parentId: null,
      description: null,
      imageUrl: null,
      status: 'ACTIVE' as const,
      createdAt: '',
      updatedAt: '',
    };
    const categories: Category[] = [
      { ...base, id: 'c1', name: 'Electronics', slug: 'electronics', isDemo: true },
      { ...base, id: 'c2', name: 'My Category', slug: 'my-category', isDemo: false },
    ];
    render(
      <CategoryTree
        categories={categories}
        canWrite={false}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getAllByText('Sample')).toHaveLength(1);
    expect(screen.getByText('Electronics').closest('li')).toHaveTextContent('Sample');
    expect(screen.getByText('My Category').closest('li')).not.toHaveTextContent('Sample');
  });
});
