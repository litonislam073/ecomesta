'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { badgeText, useAdminBadges } from '@/lib/admin-badges';
import { ADMIN_NAV } from '@/lib/nav';

/** What each counter means, for screen readers. */
const BADGE_MEANING: Record<string, string> = {
  '/dashboard/users': 'new',
  '/dashboard/payments': 'to review',
  '/dashboard/theme-purchases': 'to review',
};

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const badges = useAdminBadges();

  return (
    <nav aria-label="Platform admin" className="space-y-6">
      {ADMIN_NAV.map((section) => (
        <div key={section.title}>
          <p className="px-3 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
            {section.title}
          </p>
          <ul className="mt-2 space-y-1">
            {section.items.map((item) => {
              const active =
                item.href === '/dashboard'
                  ? pathname === item.href
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    className={`flex items-center justify-between rounded-md px-3 py-2 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] ${
                      active
                        ? 'bg-[var(--color-accent)] text-white'
                        : 'text-[var(--color-ink)] hover:bg-[#e8eeeb]'
                    }`}
                  >
                    <span>{item.label}</span>
                    {badges[item.href] ? (
                      <span
                        className={`ml-2 inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-bold leading-none ${
                          active ? 'bg-white text-[var(--color-accent)]' : 'bg-[#d92d20] text-white'
                        }`}
                      >
                        {badgeText(badges[item.href]!)}
                        <span className="sr-only"> {BADGE_MEANING[item.href]}</span>
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
