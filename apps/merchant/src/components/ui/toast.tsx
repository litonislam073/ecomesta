'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

type ToastTone = 'info' | 'success' | 'error';

interface ToastItem {
  id: string;
  message: string;
  tone: ToastTone;
}

interface ToastContextValue {
  pushToast: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const pushToast = useCallback((message: string, tone: ToastTone = 'info') => {
    const id = `${Date.now()}-${Math.random()}`;
    setItems((prev) => [...prev, { id, message, tone }]);
    window.setTimeout(() => {
      setItems((prev) => prev.filter((item) => item.id !== id));
    }, 3500);
  }, []);

  const value = useMemo(() => ({ pushToast }), [pushToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Inset on both sides on small screens so toasts never spill off-screen. */}
      <div className="pointer-events-none fixed bottom-4 left-4 right-4 z-[60] flex flex-col gap-2 sm:left-auto sm:w-full sm:max-w-sm">
        {items.map((item) => (
          <div
            key={item.id}
            role="status"
            className={`rounded-md border px-3 py-2 text-sm shadow-md ${
              item.tone === 'error'
                ? 'border-[var(--color-danger)]/40 bg-[#fff7f6] text-[var(--color-danger)]'
                : item.tone === 'success'
                  ? 'border-[#0f6b5c]/30 bg-[#edf8f4] text-[#0b5c45]'
                  : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink)]'
            }`}
          >
            {item.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return ctx;
}
