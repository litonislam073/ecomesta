import Link from 'next/link';

/** A headline number with its change against the previous period. */
export function KpiCard({
  label,
  value,
  change,
  locked = false,
  hint,
}: {
  label: string;
  value: string;
  /** Percent change; null hides it. */
  change?: number | null;
  /** Part of full analytics (Growth, Business). */
  locked?: boolean;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <p className="text-xs font-medium text-[var(--color-muted)]">{label}</p>
      {locked ? (
        <p className="mt-2 text-sm">
          <Link href="/dashboard/billing" className="font-semibold text-[var(--color-accent)] hover:underline">
            Upgrade to see
          </Link>
          <span className="block text-xs text-[var(--color-muted)]">Growth and Business plans</span>
        </p>
      ) : (
        <>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
          {change != null ? <Change value={change} /> : hint ? <p className="text-xs text-[var(--color-muted)]">{hint}</p> : null}
        </>
      )}
    </div>
  );
}

function Change({ value }: { value: number }) {
  const tone = value > 0 ? 'text-[#0b7a55]' : value < 0 ? 'text-[var(--color-danger)]' : 'text-[var(--color-muted)]';
  const arrow = value > 0 ? '↑' : value < 0 ? '↓' : '';
  return (
    <p className={`text-xs font-medium ${tone}`}>
      <span aria-hidden="true">{arrow} </span>
      {value === 0 ? 'No change' : `${Math.abs(value)}% ${value > 0 ? 'up' : 'down'}`}
      <span className="font-normal text-[var(--color-muted)]"> vs previous period</span>
    </p>
  );
}
