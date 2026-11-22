import { LoadingState } from '@/components/ui/loading-state';

/** Shared `loading.tsx` body for admin detail routes during client navigations. */
export function DetailLoading({ label }: { label: string }) {
  return (
    <div className="space-y-6">
      <div className="h-8 w-48 animate-pulse rounded bg-[#e4ebe8]" />
      <div className="h-4 w-72 animate-pulse rounded bg-[#e4ebe8]" />
      <LoadingState label={label} />
    </div>
  );
}
