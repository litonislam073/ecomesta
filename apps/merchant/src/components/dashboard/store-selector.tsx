'use client';

import { Select } from '@/components/ui/select';
import { useStoreContext } from '@/lib/store-context';

export function StoreSelector() {
  const { stores, selectedStoreId, setSelectedStoreId, loading, error } =
    useStoreContext();

  if (loading) {
    return (
      <div className="h-9 w-44 animate-pulse rounded-md bg-[#e4ebe8]" aria-hidden />
    );
  }

  if (error) {
    return (
      <p className="text-xs text-[var(--color-danger)]" role="alert">
        Stores unavailable
      </p>
    );
  }

  if (stores.length === 0) {
    return (
      <p className="text-xs text-[var(--color-muted)]">No stores available</p>
    );
  }

  return (
    <label className="flex min-w-[12rem] flex-col gap-1">
      <span className="sr-only">Selected store</span>
      <Select
        value={selectedStoreId ?? ''}
        onChange={(event) => setSelectedStoreId(event.target.value)}
        aria-label="Selected store"
      >
        {stores.map((store) => (
          <option key={store.id} value={store.id}>
            {store.name}
          </option>
        ))}
      </Select>
    </label>
  );
}
