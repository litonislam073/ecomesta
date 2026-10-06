'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@ecomesta/ui';
import { AccessDenied } from '@/components/admin/access-denied';
import { SidebarNav } from '@/components/admin/sidebar-nav';
import { Badge } from '@/components/ui/badge';
import { LoadingState } from '@/components/ui/loading-state';
import { displayName } from '@/lib/admin-utils';
import { useAuth } from '@/lib/auth-context';

export function AdminShell({ children }: { children: ReactNode }) {
  const { user, loading, isSuperAdmin, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [loading, user, router, pathname]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl p-8">
        <LoadingState label="Checking session" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (!isSuperAdmin) {
    return <AccessDenied email={user.email} />;
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-ink)]">
      <div className="mx-auto flex min-h-screen max-w-[1400px]">
        <aside className="hidden w-64 shrink-0 border-r border-[var(--color-border)] bg-[var(--color-surface)] lg:block">
          <div className="sticky top-0 flex h-screen flex-col px-3 py-5">
            <Link href="/dashboard" className="block px-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/ecomesta-logo.png" alt="Ecomesta" width={504} height={96} className="h-7 w-auto" />
            </Link>
            <p className="mt-1 px-3 text-xs text-[var(--color-muted)]">Platform admin</p>
            <div className="mt-8 flex-1 overflow-y-auto pb-6">
              <SidebarNav />
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b border-[var(--color-border)] bg-[var(--color-surface)]/95 backdrop-blur">
            <div className="flex items-center justify-between gap-3 px-4 py-3 md:px-6">
              <div className="flex shrink-0 items-center gap-3">
                <Button
                  variant="secondary"
                  className="lg:hidden"
                  aria-expanded={mobileOpen}
                  aria-controls="mobile-sidebar"
                  onClick={() => setMobileOpen((open) => !open)}
                >
                  Menu
                </Button>
                <Badge tone="warning">Super Admin</Badge>
              </div>
              {/* min-w-0 + truncate: a long email must not push the page wider than a phone screen. */}
              <div className="flex min-w-0 items-center gap-3">
                <div className="min-w-0 max-w-[14rem] text-right">
                  <p className="truncate text-sm font-medium" title={displayName(user)}>
                    {displayName(user)}
                  </p>
                  <p className="truncate text-xs text-[var(--color-muted)]" title={user.email}>
                    {user.email}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  className="shrink-0"
                  onClick={() => {
                    void logout().then(() => router.replace('/login'));
                  }}
                >
                  Log out
                </Button>
              </div>
            </div>
          </header>

          {mobileOpen ? (
            <div
              id="mobile-sidebar"
              className="border-b border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-4 lg:hidden"
            >
              <SidebarNav onNavigate={() => setMobileOpen(false)} />
            </div>
          ) : null}

          <main className="flex-1 px-4 py-6 md:px-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
