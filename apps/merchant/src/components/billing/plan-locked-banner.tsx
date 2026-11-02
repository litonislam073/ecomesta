import Link from 'next/link';

/** Growth/Business upgrade callout — same pattern as landing pages and payments. */
export function PlanLockedBanner({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <section
      role="status"
      aria-labelledby="plan-locked-title"
      className="flex flex-wrap items-center gap-4 rounded-2xl border border-[#f1d9a6] bg-[#fff8ea] p-5"
    >
      <span
        aria-hidden="true"
        className="flex h-10 w-10 items-center justify-center rounded-full bg-[#fde9bd] text-lg"
      >
        🔒
      </span>
      <div className="min-w-0 flex-1">
        <h2 id="plan-locked-title" className="font-semibold">
          {title}
        </h2>
        <p className="mt-0.5 text-sm text-[var(--color-muted)]">{description}</p>
      </div>
      <Link
        href="/dashboard/billing"
        className="inline-flex h-10 items-center rounded-md bg-[#8a5a00] px-4 text-sm font-semibold text-white hover:bg-[#6f4800]"
      >
        Upgrade in Plan &amp; billing →
      </Link>
    </section>
  );
}
