import Link from 'next/link';
import type { ReactNode } from 'react';

export const MARKETING_FOCUS =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]';

const BUTTON_STYLES = {
  primary: `bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] border-transparent shadow-sm`,
  secondary: `bg-white text-[var(--color-ink)] border-[var(--color-border)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]`,
} as const;

export function ButtonLink({
  href,
  children,
  variant = 'primary',
  size = 'md',
  cta,
  className = '',
}: {
  href: string;
  children: ReactNode;
  variant?: keyof typeof BUTTON_STYLES;
  size?: 'sm' | 'md';
  /** Stable hook for future conversion tracking. */
  cta?: string;
  className?: string;
}) {
  const classes = `inline-flex items-center justify-center rounded-lg border font-semibold transition-colors ${
    size === 'sm' ? 'px-4 py-2 text-sm' : 'px-5 py-3 text-base'
  } ${BUTTON_STYLES[variant]} ${MARKETING_FOCUS} ${className}`;

  if (href.startsWith('/')) {
    return (
      <Link href={href} className={classes} data-cta={cta}>
        {children}
      </Link>
    );
  }
  return (
    <a href={href} className={classes} data-cta={cta}>
      {children}
    </a>
  );
}

export function CheckList({ items, className = '' }: { items: string[]; className?: string }) {
  return (
    <ul className={`space-y-3 ${className}`}>
      {items.map((item) => (
        <li key={item} className="flex gap-3 text-[var(--color-ink)]">
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            className="mt-1 h-4 w-4 shrink-0 text-[var(--color-accent)]"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
          >
            <path d="M4 10.5l4 4 8-9" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
