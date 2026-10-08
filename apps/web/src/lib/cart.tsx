'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { trackAddToCart } from '@/lib/tracking';
import { addMoney, multiplyMoney } from '@/lib/money';

export type CartLine = {
  productId: string;
  productSlug: string;
  productName: string;
  variantId: string | null;
  variantName: string | null;
  sku: string | null;
  unitPrice: string;
  quantity: number;
  imageUrl: string | null;
};

type CartState = {
  storeId: string;
  storeSlug: string;
  currency: string;
  lines: CartLine[];
  /** Store-scoped coupon code draft (validated server-side at apply/checkout). */
  couponCode: string | null;
};

type CartContextValue = {
  /** False until the saved cart has been read from this browser. */
  hydrated: boolean;
  storeSlug: string;
  currency: string;
  lines: CartLine[];
  couponCode: string | null;
  itemCount: number;
  subtotal: string;
  drawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
  addItem: (line: Omit<CartLine, 'quantity'> & { quantity?: number }) => void;
  setQuantity: (key: string, quantity: number) => void;
  removeItem: (key: string) => void;
  clear: () => void;
  setCouponCode: (code: string | null) => void;
  /** Replace stored snapshot prices with server-quoted ones (SF-03). */
  syncPrices: (lines: PricedLine[]) => void;
  lineKey: (line: Pick<CartLine, 'productId' | 'variantId'>) => string;
};

type PricedLine = Pick<CartLine, 'productId' | 'variantId' | 'unitPrice'>;

const CartContext = createContext<CartContextValue | null>(null);

function storageKey(storeSlug: string) {
  return `ecomesta_cart_${storeSlug}`;
}

export function lineKey(line: Pick<CartLine, 'productId' | 'variantId'>) {
  return `${line.productId}:${line.variantId ?? 'base'}`;
}

function emptyCart(storeId: string, storeSlug: string, currency: string): CartState {
  return { storeId, storeSlug, currency, lines: [], couponCode: null };
}

export function CartProvider({
  storeId,
  storeSlug,
  currency,
  children,
}: {
  storeId: string;
  storeSlug: string;
  currency: string;
  children: ReactNode;
}) {
  const [state, setState] = useState<CartState>(() =>
    emptyCart(storeId, storeSlug, currency),
  );
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey(storeSlug));
      if (raw) {
        const parsed = JSON.parse(raw) as CartState;
        if (parsed.storeSlug === storeSlug && parsed.storeId === storeId) {
          setState({
            ...parsed,
            currency: currency || parsed.currency,
            lines: Array.isArray(parsed.lines) ? parsed.lines : [],
            couponCode:
              typeof parsed.couponCode === 'string' && parsed.couponCode.trim()
                ? parsed.couponCode.trim().toUpperCase()
                : null,
          });
        } else {
          setState(emptyCart(storeId, storeSlug, currency));
        }
      } else {
        setState(emptyCart(storeId, storeSlug, currency));
      }
    } catch {
      setState(emptyCart(storeId, storeSlug, currency));
    }
    setHydrated(true);
  }, [storeId, storeSlug, currency]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(storageKey(storeSlug), JSON.stringify(state));
  }, [state, storeSlug, hydrated]);

  const addItem = useCallback(
    (line: Omit<CartLine, 'quantity'> & { quantity?: number }) => {
      const qty = Math.max(1, line.quantity ?? 1);
      trackAddToCart(
        {
          id: line.sku || line.productId,
          name: line.productName,
          variant: line.variantName,
          price: Number(line.unitPrice),
          quantity: qty,
        },
        currency,
      );
      setState((prev) => {
        if (prev.storeId !== storeId) {
          return {
            storeId,
            storeSlug,
            currency,
            lines: [{ ...line, quantity: qty }],
            couponCode: null,
          };
        }
        const key = lineKey(line);
        const existing = prev.lines.find((l) => lineKey(l) === key);
        if (existing) {
          return {
            ...prev,
            lines: prev.lines.map((l) =>
              lineKey(l) === key
                ? { ...l, quantity: l.quantity + qty, unitPrice: line.unitPrice }
                : l,
            ),
          };
        }
        return {
          ...prev,
          lines: [...prev.lines, { ...line, quantity: qty }],
        };
      });
    },
    [storeId, storeSlug, currency],
  );

  const setQuantity = useCallback((key: string, quantity: number) => {
    setState((prev) => ({
      ...prev,
      lines:
        quantity <= 0
          ? prev.lines.filter((l) => lineKey(l) !== key)
          : prev.lines.map((l) =>
              lineKey(l) === key ? { ...l, quantity: Math.floor(quantity) } : l,
            ),
    }));
  }, []);

  const removeItem = useCallback((key: string) => {
    setState((prev) => ({
      ...prev,
      lines: prev.lines.filter((l) => lineKey(l) !== key),
    }));
  }, []);

  const clear = useCallback(() => {
    setState((prev) => ({ ...prev, lines: [], couponCode: null }));
  }, []);

  const setCouponCode = useCallback((code: string | null) => {
    setState((prev) => ({
      ...prev,
      couponCode: code?.trim() ? code.trim().toUpperCase() : null,
    }));
  }, []);

  const syncPrices = useCallback((priced: PricedLine[]) => {
    const current = new Map(priced.map((l) => [lineKey(l), l.unitPrice]));
    setState((prev) => {
      let changed = false;
      const lines = prev.lines.map((l) => {
        const unitPrice = current.get(lineKey(l));
        if (unitPrice === undefined || unitPrice === l.unitPrice) return l;
        changed = true;
        return { ...l, unitPrice };
      });
      return changed ? { ...prev, lines } : prev;
    });
  }, []);

  const itemCount = useMemo(
    () => state.lines.reduce((sum, l) => sum + l.quantity, 0),
    [state.lines],
  );

  const subtotal = useMemo(
    () =>
      state.lines.reduce(
        (sum, l) => addMoney(sum, multiplyMoney(l.unitPrice, l.quantity)),
        '0.00',
      ),
    [state.lines],
  );

  const value: CartContextValue = {
    hydrated,
    storeSlug,
    currency,
    lines: state.lines,
    couponCode: state.couponCode,
    itemCount,
    subtotal,
    drawerOpen,
    setDrawerOpen,
    addItem,
    setQuantity,
    removeItem,
    clear,
    setCouponCode,
    syncPrices,
    lineKey,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error('useCart must be used within CartProvider');
  }
  return ctx;
}
