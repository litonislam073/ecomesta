'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { DASHBOARD_NAV, isNavItemActive } from '@/lib/nav';
import { badgeText } from '@/lib/new-orders';

const linkBase =
  'flex items-center justify-between rounded-md px-3 py-2 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]';

export function SidebarNav({
  onNavigate,
  badges = {},
}: {
  onNavigate?: () => void;
  /** Counts shown next to links, by href (e.g. new orders on Orders). */
  badges?: Record<string, number>;
}) {
  const pathname = usePathname() ?? '';

  return (
    <nav aria-label="Dashboard" className="space-y-6">
      {DASHBOARD_NAV.map((section) => (
        <div key={section.title}>
          <p className="px-3 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
            {section.title}
          </p>
          <ul className="mt-2 space-y-1">
            {section.items.map((item) => {
              const active = isNavItemActive(pathname, item.href);
              const exact = pathname === item.href;
              const expanded = Boolean(item.children?.length) && active;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={exact ? 'page' : undefined}
                    aria-expanded={item.children?.length ? expanded : undefined}
                    className={`${linkBase} ${
                      active
                        ? 'bg-[var(--color-accent)] text-white'
                        : 'text-[var(--color-ink)] hover:bg-[#e8eeeb]'
                    }`}
                  >
                    <span>{item.label}</span>
                    {item.tag ? (
                      <span
                        className={`ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase leading-none tracking-wide ${
                          active ? 'bg-white text-[var(--color-accent)]' : 'bg-[#e3f4ec] text-[#13684a]'
                        }`}
                      >
                        {item.tag}
                      </span>
                    ) : null}
                    {badges[item.href] ? (
                      <span
                        className={`ml-2 inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-bold leading-none ${
                          active ? 'bg-white text-[var(--color-accent)]' : 'bg-[#d92d20] text-white'
                        }`}
                      >
                        {badgeText(badges[item.href]!)}
                        <span className="sr-only"> new</span>
                      </span>
                    ) : null}
                    {!item.ready ? (
                      <span
                        className={`ml-2 whitespace-nowrap rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase leading-none tracking-wide ${
                          active ? 'bg-white text-[var(--color-accent)]' : 'bg-[#fff1d6] text-[#8a5a00]'
                        }`}
                      >
                        Coming soon
                      </span>
                    ) : null}
                  </Link>
                  {expanded ? (
                    <ul
                      className="ml-3 mt-1 space-y-0.5 border-l border-[var(--color-border)] pl-2"
                      aria-label={`${item.label} sections`}
                    >
                      {item.children!.map((child) => {
                        const childActive = isNavItemActive(pathname, child.href);
                        return (
                          <li key={child.href}>
                            <Link
                              href={child.href}
                              onClick={onNavigate}
                              aria-current={childActive ? 'page' : undefined}
                              className={`${linkBase} py-1.5 ${
                                childActive
                                  ? 'font-medium text-[var(--color-accent)]'
                                  : 'text-[var(--color-muted)] hover:bg-[#e8eeeb] hover:text-[var(--color-ink)]'
                              }`}
                            >
                              {child.label}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
