import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CategoriesPage from '@/app/dashboard/categories/page';
import { CategoryForm } from '@/components/catalog/category-form';
import { CategoryTree } from '@/components/catalog/category-tree';
import { ApiError } from '@/lib/api-client';

const pushToast = vi.fn();
let selectedStoreId = 'store-1';
let canManage = true;

vi.mock('@/lib/store-context', () => ({
  useStoreContext: () => ({
    selectedStoreId,
    selectedStore: {
      id: selectedStoreId,
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

const electronics = {
  id: 'cat-1',
  storeId: 'store-1',
  parentId: null,
  name: 'Electronics',
  slug: 'electronics',
  description: null,
  imageUrl: null,
  status: 'ACTIVE' as const,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const mobile = {
  ...electronics,
  id: 'cat-2',
  parentId: 'cat-1',
  name: 'Mobile',
  slug: 'mobile',
};

describe('Categories UI', () => {
  beforeEach(() => {
    selectedStoreId = 'store-1';
    canManage = true;
    pushToast.mockReset();
    api.get.mockReset();
    api.post.mockReset();
    api.patch.mockReset();
    api.delete.mockReset();
  });

  it('loads category list/tree', async () => {
    api.get.mockResolvedValue({
      success: true,
      data: {
        items: [{ ...electronics, children: [{ ...mobile, children: [] }] }],
        meta: { total: 2, tree: true },
      },
    });

    render(<CategoriesPage />);
    expect(await screen.findByRole('heading', { name: 'Categories' })).toBeInTheDocument();
    expect(screen.getAllByText('Electronics').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Mobile').length).toBeGreaterThan(0);
  });

  it('renders category tree nesting', () => {
    render(
      <CategoryTree
        categories={[electronics, mobile]}
        canWrite={false}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getAllByText('Electronics').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Mobile').length).toBeGreaterThan(0);
  });

  it('creates a category', async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue({
      success: true,
      data: { items: [], meta: { total: 0, tree: true } },
    });
    api.post.mockResolvedValue({ success: true, data: electronics });

    render(<CategoriesPage />);
    expect(await screen.findByText('No categories yet')).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: /add category/i })[0]!);
    await user.type(screen.getByLabelText(/^name$/i), 'Electronics');
    await user.clear(screen.getByLabelText(/^slug$/i));
    await user.type(screen.getByLabelText(/^slug$/i), 'electronics');
    await user.click(screen.getByRole('button', { name: /create category/i }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        '/stores/store-1/categories',
        expect.objectContaining({ name: 'Electronics', slug: 'electronics' }),
      );
    });
    expect(pushToast).toHaveBeenCalledWith('Category created.', 'success');
  });

  it('updates a category', async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue({
      success: true,
      data: {
        items: [{ ...electronics, children: [] }],
        meta: { total: 1, tree: true },
      },
    });
    api.patch.mockResolvedValue({
      success: true,
      data: { ...electronics, name: 'Gadgets' },
    });

    render(<CategoriesPage />);
    await screen.findAllByText('Electronics');
    await user.click(screen.getAllByRole('button', { name: /^edit$/i })[0]!);
    const form = screen.getByRole('button', { name: /update category/i }).closest('form')!;
    await user.clear(within(form).getByLabelText(/^name$/i));
    await user.type(within(form).getByLabelText(/^name$/i), 'Gadgets');
    await user.click(screen.getByRole('button', { name: /update category/i }));

    await waitFor(() => expect(api.patch).toHaveBeenCalled());
    expect(pushToast).toHaveBeenCalledWith('Category updated.', 'success');
  });

  it('deletes a category after confirmation', async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue({
      success: true,
      data: {
        items: [{ ...electronics, children: [] }],
        meta: { total: 1, tree: true },
      },
    });
    api.delete.mockResolvedValue({ success: true, data: { id: 'cat-1', deleted: true } });

    render(<CategoriesPage />);
    await screen.findAllByText('Electronics');
    await user.click(screen.getAllByRole('button', { name: /^delete$/i })[0]!);
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /^delete$/i }));

    await waitFor(() => {
      expect(api.delete).toHaveBeenCalledWith('/stores/store-1/categories/cat-1');
    });
  });

  it('handles 409 category deletion gracefully', async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue({
      success: true,
      data: {
        items: [{ ...electronics, children: [] }],
        meta: { total: 1, tree: true },
      },
    });
    api.delete.mockRejectedValue(
      new ApiError(409, 'CONFLICT', 'Category has child categories'),
    );

    render(<CategoriesPage />);
    await screen.findAllByText('Electronics');
    await user.click(screen.getAllByRole('button', { name: /^delete$/i })[0]!);
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /^delete$/i }));

    await waitFor(() => {
      expect(pushToast).toHaveBeenCalledWith(
        'This category cannot be deleted because it is still being used.',
        'error',
      );
    });
  });

  it('has no image option (category images are set in the theme editor)', () => {
    render(<CategoryForm categories={[]} submitLabel="Create category" onSubmit={vi.fn()} />);
    expect(screen.queryByText(/image/i)).toBeNull();
    expect(screen.queryByRole('button', { name: /upload/i })).toBeNull();
  });

  it('prevents selecting self or descendants as parent in the form', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <CategoryForm
        editingId="cat-1"
        categories={[electronics, mobile]}
        initial={{
          name: 'Electronics',
          slug: 'electronics',
          description: '',
          parentId: '',
          status: 'ACTIVE',
        }}
        submitLabel="Update category"
        onSubmit={onSubmit}
      />,
    );

    const parent = screen.getByLabelText(/^parent$/i);
    expect(within(parent).queryByRole('option', { name: 'Electronics' })).toBeNull();
    expect(within(parent).queryByRole('option', { name: 'Mobile' })).toBeNull();
    expect(within(parent).getByRole('option', { name: /none \(root\)/i })).toBeInTheDocument();

    // Attempt submit without invalid parent still works with root
    await user.click(screen.getByRole('button', { name: /update category/i }));
    expect(onSubmit).toHaveBeenCalled();
  });
});
