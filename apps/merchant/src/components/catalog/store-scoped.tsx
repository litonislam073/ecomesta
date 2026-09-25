'use client';

import type { ReactNode } from 'react';
import { useStoreContext } from '@/lib/store-context';

/**
 * Remount children when the selected store changes so previous store data
 * cannot linger in local component state.
 */
export function StoreScoped({ children }: { children: ReactNode }) {
  const { selectedStoreId } = useStoreContext();
  return <div key={selectedStoreId ?? 'no-store'}>{children}</div>;
}
