import type { ReactNode } from 'react';
import {
  CheckList,
  MarketingShell,
  type MarketingCurrentPage,
} from '@ecomesta/ui/marketing';
import { marketingSiteUrl } from '@/lib/marketing-site';

export const AUTH_CARD_CLASSES =
  'rounded-2xl border border-[var(--color-border)] bg-white p-6 shadow-[0_1px_2px_rgba(2,40,87,0.05),0_12px_32px_-12px_rgba(2,40,87,0.16)] sm:p-8';

interface AuthSplitProps {
  eyebrow: string;
  heading: string;
  description: string;
  points: string[];
  children: ReactNode;
}

/** Marketing message beside the form card; card first on small screens. */
export function AuthSplit({ eyebrow, heading, description, points, children }: AuthSplitProps) {
  return (
    <section className="relative isolate border-b border-[var(--color-border)]">
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_left,rgba(1,135,240,0.10),transparent_55%),radial-gradient(ellipse_at_bottom_right,rgba(3,165,129,0.08),transparent_50%)]"
      />
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[1fr_minmax(0,28rem)] lg:items-center lg:gap-16 lg:py-24">
        <div className="order-2 lg:order-1">
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--color-accent)]">
            {eyebrow}
          </p>
          <p className="mt-3 font-display text-3xl leading-tight tracking-tight text-[var(--color-ink)] sm:text-4xl">
            {heading}
          </p>
          <p className="mt-4 max-w-lg text-lg leading-relaxed text-[var(--color-muted)]">
            {description}
          </p>
          <CheckList items={points} className="mt-8" />
        </div>
        <div className="order-1 w-full lg:order-2">
          <div className={AUTH_CARD_CLASSES}>{children}</div>
        </div>
      </div>
    </section>
  );
}

export function AuthLayout({
  current,
  ...split
}: AuthSplitProps & { current?: MarketingCurrentPage }) {
  return (
    <MarketingShell
      siteOrigin={marketingSiteUrl()}
      loginHref="/login"
      registerHref="/register"
      current={current}
    >
      <AuthSplit {...split} />
    </MarketingShell>
  );
}
