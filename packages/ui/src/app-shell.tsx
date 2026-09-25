import type { ReactNode } from 'react';

export interface AppShellProps {
  brand: string;
  title: string;
  description?: string;
  children?: ReactNode;
}

export function AppShell({ brand, title, description, children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-ink)]">
      <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <p className="font-[family-name:var(--font-display)] text-xl tracking-tight">{brand}</p>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-16">
        <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-tight md:text-5xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-4 max-w-2xl text-lg text-[var(--color-muted)]">{description}</p>
        ) : null}
        {children ? <div className="mt-10">{children}</div> : null}
      </main>
    </div>
  );
}
