import Link from 'next/link';
import type { ReactNode } from 'react';
import { ButtonLink, CheckList, MARKETING_FOCUS } from '@ecomesta/ui/marketing';

export function Container({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`mx-auto w-full max-w-[1200px] px-4 sm:px-6 ${className}`}>{children}</div>;
}

const FOCUS = MARKETING_FOCUS;

export { ButtonLink, CheckList };

export function TextLink({
  href,
  children,
  className = '',
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`font-semibold text-[var(--color-accent)] underline-offset-4 hover:underline ${FOCUS} rounded-sm ${className}`}
    >
      {children}
    </Link>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--color-accent)]">
      {children}
    </p>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  id,
  align = 'left',
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  id?: string;
  align?: 'left' | 'center';
}) {
  return (
    <div className={align === 'center' ? 'mx-auto max-w-2xl text-center' : 'max-w-2xl'}>
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      <h2
        id={id}
        className="mt-2 font-display text-3xl leading-tight tracking-tight text-[var(--color-ink)] sm:text-4xl"
      >
        {title}
      </h2>
      {description ? (
        <p className="mt-4 text-lg leading-relaxed text-[var(--color-muted)]">{description}</p>
      ) : null}
    </div>
  );
}
