import type { ReactNode } from 'react';
import Link from 'next/link';

export function PageHeader({
  title,
  description,
  backHref,
  backLabel,
  actions,
}: {
  title: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        {backHref ? (
          <Link
            href={backHref}
            className="text-sm text-[var(--color-accent)] hover:underline"
          >
            ← {backLabel ?? 'Back'}
          </Link>
        ) : null}
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl tracking-tight">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 text-[var(--color-muted)]">{description}</p>
        ) : null}
      </div>
      {actions}
    </div>
  );
}
