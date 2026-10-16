import type { InventoryItem, OffsetPageMeta, ProductVariant } from '@ecomesta/types';
import { api } from '@/lib/api-client';

/** One place stock is counted: the product itself, or each of its variants. */
export type StockTarget = {
  variantId: string | null;
  label: string;
  quantity: number;
  reserved: number;
};

export const PRODUCT_STOCK_KEY = 'product';

export function stockKey(variantId: string | null): string {
  return variantId ?? PRODUCT_STOCK_KEY;
}

/** Products with variants keep stock per variant; others keep one count. */
export function stockTargetsFor(variants: Pick<ProductVariant, 'id' | 'name'>[], items: InventoryItem[]): StockTarget[] {
  const find = (variantId: string | null) => items.find((item) => item.variantId === variantId);
  if (variants.length === 0) {
    const item = find(null);
    return [{ variantId: null, label: 'Stock quantity', quantity: item?.quantity ?? 0, reserved: item?.reservedQuantity ?? 0 }];
  }
  return variants.map((variant) => {
    const item = find(variant.id);
    return { variantId: variant.id, label: variant.name, quantity: item?.quantity ?? 0, reserved: item?.reservedQuantity ?? 0 };
  });
}

/** Whole numbers from 0 up; returns an error message or null. */
export function stockError(raw: string, target: StockTarget, allowBackorder: boolean): string | null {
  const value = raw.trim();
  if (!/^\d+$/.test(value) || Number(value) > 1_000_000) {
    return `${target.label}: enter a whole number of 0 or more.`;
  }
  if (!allowBackorder && Number(value) < target.reserved) {
    return `${target.label}: ${target.reserved} are held for open orders, so stock cannot be less than that.`;
  }
  return null;
}

export async function fetchProductInventory(storeId: string, productId: string): Promise<InventoryItem[]> {
  const res = await api.get<{ success: true; data: { items: InventoryItem[]; meta: OffsetPageMeta } }>(
    `/stores/${storeId}/inventory?productId=${encodeURIComponent(productId)}&limit=100`,
  );
  return res.data.items;
}

/**
 * Sets each count to the number the merchant typed. The change is recorded as
 * an inventory adjustment against the latest count, so a sale that happened
 * while the page was open is not lost.
 */
export async function saveProductStock(
  storeId: string,
  productId: string,
  targets: StockTarget[],
  wanted: Record<string, string>,
): Promise<number> {
  const changed = targets.filter((target) => {
    const raw = wanted[stockKey(target.variantId)];
    return raw !== undefined && raw.trim() !== '' && Number(raw) !== target.quantity;
  });
  if (changed.length === 0) return 0;
  const latest = await fetchProductInventory(storeId, productId);
  let saved = 0;
  for (const target of changed) {
    const current = latest.find((item) => item.variantId === target.variantId)?.quantity ?? 0;
    const delta = Number(wanted[stockKey(target.variantId)]) - current;
    if (delta === 0) continue;
    await api.post(`/stores/${storeId}/inventory/adjust`, {
      productId,
      variantId: target.variantId,
      quantity: delta,
      type: 'ADJUSTMENT',
      note: 'Stock set on the product page',
    });
    saved += 1;
  }
  return saved;
}
