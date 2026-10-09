import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HomepageBlockPanel } from '@/components/theme/homepage-block-panel';

const pushToast = vi.fn();
vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ pushToast }),
}));

const api = { get: vi.fn(), patch: vi.fn() };
vi.mock('@/lib/api-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api-client')>('@/lib/api-client');
  return {
    ...actual,
    api: {
      get: (...args: unknown[]) => api.get(...args),
      patch: (...args: unknown[]) => api.patch(...args),
    },
  };
});

beforeEach(() => {
  api.get.mockResolvedValue({
    success: true,
    data: {
      items: [
        { id: 'cat-1', name: 'Shoes', imageUrl: null },
        { id: 'cat-2', name: 'Bags', imageUrl: 'https://cdn.example.com/bags.jpg' },
      ],
    },
  });
  api.patch.mockResolvedValue({ success: true, data: {} });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('Categories section: category images', () => {
  it('saves a category image to the category and refreshes the preview', async () => {
    const user = userEvent.setup();
    const onCatalogChange = vi.fn();
    render(
      <HomepageBlockPanel
        type="featured_categories"
        storeId="store-1"
        value={{}}
        onChange={vi.fn()}
        onCatalogChange={onCatalogChange}
      />,
    );

    const images = await screen.findByRole('region', { name: 'Category images' });
    expect(within(images).getByRole('button', { name: 'Change image for Bags' })).toBeInTheDocument();
    await user.click(within(images).getByRole('button', { name: 'Add image for Shoes' }));

    const field = within(images).getByRole('group', { name: 'Shoes image' });
    expect(within(field).getByRole('button', { name: /^Upload$/ })).toBeEnabled();
    expect(within(field).getByRole('button', { name: 'Choose from gallery' })).toBeEnabled();
    await user.type(within(field).getByLabelText(/^Shoes image URL/), 'https://cdn.example.com/shoes.jpg');
    await user.click(within(images).getByRole('button', { name: 'Save image' }));

    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith('/stores/store-1/categories/cat-1', { imageUrl: 'https://cdn.example.com/shoes.jpg' }),
    );
    expect(onCatalogChange).toHaveBeenCalled();
    expect(pushToast).toHaveBeenCalledWith('Image saved for Shoes.', 'success');
    expect(within(images).getByRole('button', { name: 'Change image for Shoes' })).toBeInTheDocument();
  });

  it('is not shown on the products section', async () => {
    render(<HomepageBlockPanel type="featured_products" storeId="store-1" value={{}} onChange={vi.fn()} />);
    await screen.findByText('Shoes');
    expect(screen.queryByRole('region', { name: 'Category images' })).toBeNull();
  });
});
