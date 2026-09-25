export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
    >
      <span className="sr-only">{label}</span>
      <div className="h-4 w-1/3 animate-pulse rounded bg-[#e4ebe8]" />
      <div className="h-4 w-2/3 animate-pulse rounded bg-[#e4ebe8]" />
      <div className="h-4 w-1/2 animate-pulse rounded bg-[#e4ebe8]" />
    </div>
  );
}
