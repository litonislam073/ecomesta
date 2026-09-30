'use client';

import { Select } from '@/components/ui/select';
import { confirmLeave } from '@/lib/leave-guard';
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
    // Fills the header on narrow screens (the native select truncates long
    // store names); from `sm` up the same 12rem it always had.
    <label className="flex min-w-0 flex-1 flex-col gap-1 sm:w-48 sm:flex-none">
      <span className="sr-only">Selected store</span>
      <Select
        value={selectedStoreId ?? ''}
        onChange={(event) => {
          const next = event.target.value;
          // A page with unsaved edits (Theme editor) may ask first; the select
          // stays controlled, so cancelling keeps the current store.
          void confirmLeave().then((ok) => {
            if (ok) setSelectedStoreId(next);
          });
        }}
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
