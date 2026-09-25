import type { ReactNode } from 'react';

export function Card({
  children,
  className = '',
  title,
  description,
  actions,
}: {
  children?: ReactNode;
  className?: string;
  title?: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <section
      className={`rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] ${className}`}
    >
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--color-border)] px-4 py-3">
          <div>
            {title ? (
              <h2 className="text-base font-semibold text-[var(--color-ink)]">{title}</h2>
            ) : null}
            {description ? (
              <p className="mt-1 text-sm text-[var(--color-muted)]">{description}</p>
            ) : null}
          </div>
          {actions}
        </header>
      )}
      {children ? <div className="p-4">{children}</div> : null}
    </section>
  );
}
