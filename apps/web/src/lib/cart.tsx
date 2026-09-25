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
};

type CartContextValue = {
  storeSlug: string;
  currency: string;
  lines: CartLine[];
  itemCount: number;
  subtotal: string;
  drawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
  addItem: (line: Omit<CartLine, 'quantity'> & { quantity?: number }) => void;
  setQuantity: (key: string, quantity: number) => void;
  removeItem: (key: string) => void;
  clear: () => void;
  lineKey: (line: Pick<CartLine, 'productId' | 'variantId'>) => string;
};

const CartContext = createContext<CartContextValue | null>(null);

function storageKey(storeSlug: string) {
  return `ecomesta_cart_${storeSlug}`;
}

export function lineKey(line: Pick<CartLine, 'productId' | 'variantId'>) {
  return `${line.productId}:${line.variantId ?? 'base'}`;
}

function emptyCart(storeId: string, storeSlug: string, currency: string): CartState {
  return { storeId, storeSlug, currency, lines: [] };
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
      setState((prev) => {
        if (prev.storeId !== storeId) {
          return {
            storeId,
            storeSlug,
            currency,
            lines: [{ ...line, quantity: qty }],
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
      setDrawerOpen(true);
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
    setState((prev) => ({ ...prev, lines: [] }));
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
    storeSlug,
    currency,
    lines: state.lines,
    itemCount,
    subtotal,
    drawerOpen,
    setDrawerOpen,
    addItem,
    setQuantity,
    removeItem,
    clear,
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
