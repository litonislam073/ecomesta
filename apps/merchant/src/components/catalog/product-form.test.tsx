import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { Product } from '@ecomesta/types';
import { ProductForm, productToFormValues } from './product-form';

const product = {
  id: 'prod-1',
  storeId: 'store-1',
  name: 'Panjabi',
  slug: 'panjabi',
  description: null,
  shortDescription: null,
  status: 'ACTIVE',
  productType: 'PHYSICAL',
  sku: 'P-1',
  barcode: null,
  basePrice: '500.00',
  compareAtPrice: null,
  costPrice: null,
  trackInventory: true,
  allowBackorder: false,
  imageUrl: null,
  categoryIds: [],
  categories: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
} as unknown as Product;

const formProps = {
  categories: [],
  busy: false,
  submitLabel: 'Save changes',
  onSubmit: vi.fn(),
};

describe('ProductForm initial values', () => {
  let root: Root | null = null;
  let container: HTMLElement | null = null;

  afterEach(() => {
    if (root) act(() => root!.unmount());
    container?.remove();
    root = null;
    container = null;
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  it('keeps an edit made as soon as the form appears (before effects run)', async () => {
    // Render the way the edit page does after its data loads: outside act(),
    // so React runs passive effects in a later task, not right after commit.
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    const initial = productToFormValues(product);

    // Edit the name in the same microtask the form's DOM is committed — the
    // window a merchant (or a busy test run) can hit before effects flush.
    const edited = new Promise<void>((resolve) => {
      const observer = new MutationObserver(() => {
        const input = screen.queryByLabelText(/^name$/i);
        if (!input) return;
        observer.disconnect();
        fireEvent.change(input, { target: { value: 'Panjabi Deluxe' } });
        resolve();
      });
      observer.observe(container!, { childList: true, subtree: true });
    });
    root.render(<ProductForm {...formProps} initial={initial} />);
    await edited;

    // Flush every pending effect and render deterministically (act drains React's queue).
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    await act(async () => {});
    expect(screen.getByLabelText(/^name$/i)).toHaveValue('Panjabi Deluxe');
  });

  it('still resets the fields when a new initial value arrives', () => {
    const first = productToFormValues(product);
    const { rerender } = render(<ProductForm {...formProps} initial={first} />);
    fireEvent.change(screen.getByLabelText(/^name$/i), { target: { value: 'Draft edit' } });

    // Same object again (e.g. a parent re-render): the edit is kept.
    rerender(<ProductForm {...formProps} initial={first} />);
    expect(screen.getByLabelText(/^name$/i)).toHaveValue('Draft edit');

    // A freshly loaded product replaces the form values.
    rerender(
      <ProductForm {...formProps} initial={productToFormValues({ ...product, name: 'Reloaded' })} />,
    );
    expect(screen.getByLabelText(/^name$/i)).toHaveValue('Reloaded');
  });
});
