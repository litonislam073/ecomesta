import Link from 'next/link';

/**
 * Rendered inside the dashboard shell (sidebar + header), so a mistyped or
 * outdated link keeps the merchant signed in with the navigation in reach.
 */
export default function DashboardNotFound() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-16 text-center">
      <p className="text-sm font-medium text-[var(--color-muted)]">404</p>
      <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl tracking-tight">
        We couldn&apos;t find that page
      </h1>
      <p className="mt-3 max-w-md text-sm text-[var(--color-muted)]">
        The page may have moved or the link may be out of date. You are still signed in, so you can
        pick up where you left off from the dashboard.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link
          href="/dashboard"
          className="inline-flex items-center rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Back to dashboard
        </Link>
        <Link
          href="/dashboard/orders"
          className="inline-flex items-center rounded-md border border-[var(--color-border)] px-4 py-2 text-sm font-medium hover:bg-[var(--color-bg)]"
        >
          View orders
        </Link>
      </div>
    </div>
  );
}
