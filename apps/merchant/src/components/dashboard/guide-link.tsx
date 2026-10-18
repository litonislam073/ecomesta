import Link from 'next/link';

/** Top-bar button that opens the store guide. */
export function GuideLink() {
  return (
    <Link
      href="/dashboard/guide"
      className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-sm font-medium text-[var(--color-ink)] transition-colors hover:bg-[var(--color-bg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
    >
      <span aria-hidden="true">📘</span>
      Store guide
    </Link>
  );
}
