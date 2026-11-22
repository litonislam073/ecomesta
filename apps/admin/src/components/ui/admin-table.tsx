import type { ReactNode } from 'react';

/** Shared list table: horizontal scroll on small screens + sticky thead under the shell bar. */
export function AdminTable({
  children,
  minWidth = '44rem',
  'aria-label': ariaLabel,
}: {
  children: ReactNode;
  minWidth?: string;
  'aria-label'?: string;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
      <table
        aria-label={ariaLabel}
        className="w-full text-left text-sm"
        style={{ minWidth }}
      >
        {children}
      </table>
    </div>
  );
}

/** Use on `<thead>` so column labels stay readable under the sticky shell header. */
export const ADMIN_TABLE_HEAD =
  'sticky top-14 z-10 border-b border-[var(--color-border)] bg-[#f3f7f5] text-[var(--color-muted)] shadow-[0_1px_0_0_var(--color-border)]';
