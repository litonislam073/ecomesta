'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { DASHBOARD_NAV } from '@/lib/nav';

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Dashboard" className="space-y-6">
      {DASHBOARD_NAV.map((section) => (
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
                    {!item.ready ? (
                      <span
                        className={`text-[10px] uppercase tracking-wide ${
                          active ? 'text-white/80' : 'text-[var(--color-muted)]'
                        }`}
                      >
                        Soon
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
