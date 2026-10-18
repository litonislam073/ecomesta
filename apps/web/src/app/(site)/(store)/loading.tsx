/**
 * Shown the moment a shopper follows a link inside the store, while the next
 * page renders. Having it also lets Next.js prefetch the route shell, so the
 * header and footer stay put and the switch feels instant.
 */
export default function StoreLoading() {
  return (
    <div role="status" aria-label="Loading page" className="animate-pulse space-y-6">
      <div className="h-8 w-1/3 rounded-lg bg-[var(--color-surface)]" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className="space-y-3 rounded-2xl border border-[var(--color-border)] p-3">
            <div className="aspect-square rounded-xl bg-[var(--color-surface)]" />
            <div className="h-4 w-3/4 rounded bg-[var(--color-surface)]" />
            <div className="h-4 w-1/3 rounded bg-[var(--color-surface)]" />
          </div>
        ))}
      </div>
    </div>
  );
}
