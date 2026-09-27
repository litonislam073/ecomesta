'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { SETTINGS_NAV, isNavItemActive } from '@/lib/nav';

export function SettingsNav() {
  const pathname = usePathname() ?? '';
  const router = useRouter();
  const current =
    SETTINGS_NAV.find((item) =>
      isNavItemActive(pathname, item.href, item.href === '/dashboard/settings'),
    )?.href ?? '/dashboard/settings';

  return (
    <>
      <div className="lg:hidden">
        <label htmlFor="settings-section" className="sr-only">
          Settings section
        </label>
        <select
          id="settings-section"
          className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
          value={current}
          onChange={(e) => router.push(e.target.value)}
        >
          {SETTINGS_NAV.map((item) => (
            <option key={item.href} value={item.href}>
              {item.label}
            </option>
          ))}
        </select>
      </div>
      <nav aria-label="Settings" className="hidden lg:block">
        <ul className="space-y-0.5">
          {SETTINGS_NAV.map((item) => {
            const active = item.href === current;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`block rounded-md px-3 py-2 text-sm ${
                    active
                      ? 'bg-[#e8eeeb] font-medium text-[var(--color-ink)]'
                      : 'text-[var(--color-muted)] hover:bg-[#f3f7f5] hover:text-[var(--color-ink)]'
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
