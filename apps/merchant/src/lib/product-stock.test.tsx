import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { InventoryItem } from '@ecomesta/types';
import { ProductForm } from '@/components/catalog/product-form';
import { saveProductStock, stockError, stockTargetsFor, type StockTarget } from './product-stock';

const get = vi.fn();
const post = vi.fn();
vi.mock('@/lib/api-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api-client')>('@/lib/api-client');
  return { ...actual, api: { get: (...a: unknown[]) => get(...a), post: (...a: unknown[]) => post(...a) } };
});

const item = (variantId: string | null, quantity: number, reservedQuantity = 0) =>
  ({ id: `i-${variantId}`, productId: 'p1', variantId, quantity, reservedQuantity }) as InventoryItem;

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  post.mockResolvedValue({ success: true });
});

describe('product stock helpers', () => {
  it('uses one count without variants and one per variant otherwise', () => {
    expect(stockTargetsFor([], [item(null, 7, 2)])).toEqual([{ variantId: null, label: 'Stock quantity', quantity: 7, reserved: 2 }]);
    expect(stockTargetsFor([{ id: 'v1', name: 'Red' }, { id: 'v2', name: 'Blue' }], [item('v1', 3)])).toEqual([
      { variantId: 'v1', label: 'Red', quantity: 3, reserved: 0 },
      { variantId: 'v2', label: 'Blue', quantity: 0, reserved: 0 },
    ]);
  });

  it('accepts only whole numbers and not less than held stock', () => {
    const target: StockTarget = { variantId: null, label: 'Stock quantity', quantity: 5, reserved: 2 };
    expect(stockError('10', target, false)).toBeNull();
    expect(stockError('-1', target, false)).toMatch(/whole number/);
    expect(stockError('2.5', target, false)).toMatch(/whole number/);
    expect(stockError('1', target, false)).toMatch(/held for open orders/);
    expect(stockError('1', target, true)).toBeNull();
  });

  it('adjusts by the difference from the latest count, only where it changed', async () => {
    const targets: StockTarget[] = [
      { variantId: 'v1', label: 'Red', quantity: 3, reserved: 0 },
      { variantId: 'v2', label: 'Blue', quantity: 4, reserved: 0 },
    ];
    // A sale happened since the page loaded: Red is now 2.
    get.mockResolvedValue({ success: true, data: { items: [item('v1', 2), item('v2', 4)], meta: {} } });
    await expect(saveProductStock('s1', 'p1', targets, { v1: '10', v2: '4' })).resolves.toBe(1);
    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith('/stores/s1/inventory/adjust', expect.objectContaining({ productId: 'p1', variantId: 'v1', quantity: 8, type: 'ADJUSTMENT' }));
  });

  it('does nothing when nothing changed', async () => {
    await saveProductStock('s1', 'p1', [{ variantId: null, label: 'Stock quantity', quantity: 5, reserved: 0 }], { product: '5' });
    expect(get).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
  });
});

describe('ProductForm stock fields', () => {
  function Harness({ onSubmit }: { onSubmit: (...a: unknown[]) => void }) {
    const [targets] = useState<StockTarget[]>([{ variantId: null, label: 'Stock quantity', quantity: 4, reserved: 1 }]);
    return (
      <ProductForm
        categories={[]}
        submitLabel="Save"
        stockTargets={targets}
        initial={{ name: 'Mug', slug: 'mug', description: '', shortDescription: '', status: 'ACTIVE', productType: 'PHYSICAL', basePrice: '10.00', compareAtPrice: '', costPrice: '', trackInventory: true, allowBackorder: false, sku: '', barcode: '', categoryIds: [] }}
        onSubmit={onSubmit}
      />
    );
  }

  it('shows the current stock and sends the new number', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);
    const field = screen.getByLabelText('Stock quantity');
    expect(field).toHaveValue(4);
    expect(screen.getByText('1 held for open orders')).toBeInTheDocument();
    await user.clear(field);
    await user.type(field, '25');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ name: 'Mug' }), { product: '25' });
  });

  it('blocks a stock below what open orders hold', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);
    await user.clear(screen.getByLabelText('Stock quantity'));
    await user.type(screen.getByLabelText('Stock quantity'), '0');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('alert')).toHaveTextContent('held for open orders');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('hides stock when inventory is not tracked', async () => {
    const user = userEvent.setup();
    render(<Harness onSubmit={vi.fn()} />);
    await user.click(screen.getByLabelText('Track inventory'));
    expect(screen.queryByLabelText('Stock quantity')).toBeNull();
    expect(screen.getByText(/Stock is not counted/)).toBeInTheDocument();
  });
});
