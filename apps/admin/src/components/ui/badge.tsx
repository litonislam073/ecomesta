import type { ReactNode } from 'react';

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'success' | 'warning' | 'danger';
}) {
  const tones = {
    neutral: 'bg-[#e8eeeb] text-[var(--color-ink)]',
    success: 'bg-[#d8f3e7] text-[#0b5c45]',
    warning: 'bg-[#fff1d6] text-[#8a5a00]',
    danger: 'bg-[#fde8e6] text-[var(--color-danger)]',
  };
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
