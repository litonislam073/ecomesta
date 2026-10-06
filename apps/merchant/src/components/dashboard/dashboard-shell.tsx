'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@ecomesta/ui';
import { SubscriptionBanner, SuspendedScreen } from '@/components/billing/subscription-notices';
import { EmailVerificationBanner } from '@/components/dashboard/email-verification-banner';
import { SidebarNav } from '@/components/dashboard/sidebar-nav';
import { StoreSelector } from '@/components/dashboard/store-selector';
import { ViewStoreLink } from '@/components/dashboard/view-store-link';
import { LoadingState } from '@/components/ui/loading-state';
import { confirmLeave } from '@/lib/leave-guard';
import { useAuth } from '@/lib/auth-context';
import { SubscriptionProvider, useSubscription } from '@/lib/subscription-context';

const BILLING_PATH = '/dashboard/billing';

/**
 * A suspended subscription replaces every dashboard page except Plan &
 * billing; during the grace period pages stay usable under a payment notice.
 */
function SubscriptionGate({ pathname, children }: { pathname: string; children: ReactNode }) {
  const { data } = useSubscription();
  const phase = data?.subscription?.phase;
  const onBilling = pathname === BILLING_PATH || pathname.startsWith(`${BILLING_PATH}/`);
  if (data && (phase === 'SUSPENDED' || phase === 'LAPSED') && !onBilling) {
    return <SuspendedScreen data={data} />;
  }
  return (
    <>
      {data && !onBilling ? <SubscriptionBanner data={data} showTrial={pathname === '/dashboard'} /> : null}
      {children}
    </>
  );
}

export function DashboardShell({ children }: { children: ReactNode }) {
  return (
    <SubscriptionProvider>
      <DashboardFrame>{children}</DashboardFrame>
    </SubscriptionProvider>
  );
}

function DashboardFrame({ children }: { children: ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    if (
      !loading &&
      user &&
      user.memberships.stores.length === 0 &&
      !pathname.startsWith('/onboard')
    ) {
      router.replace('/onboard');
    }
  }, [loading, user, router, pathname]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // The mobile navigation panel closes on Escape and hands focus back to Menu.
  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setMobileOpen(false);
      document.getElementById('mobile-menu-button')?.focus();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [mobileOpen]);

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

  const displayName =
    [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email;

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-ink)]">
      <div className="flex min-h-screen">
        <aside className="hidden w-64 shrink-0 border-r border-[var(--color-border)] bg-[var(--color-surface)] lg:block">
          <div className="sticky top-0 flex h-screen flex-col px-3 py-5">
            <Link href="/dashboard" className="block px-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/ecomesta-logo.png" alt="Ecomesta" width={504} height={96} className="h-7 w-auto" />
            </Link>
            <p className="mt-1 px-3 text-xs text-[var(--color-muted)]">Merchant</p>
            <div className="mt-8 flex-1 overflow-y-auto pb-6">
              <SidebarNav />
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b border-[var(--color-border)] bg-[var(--color-surface)]/95 backdrop-blur">
            {/* Wraps onto a second row when it does not fit; both groups may
                shrink so nothing forces the page wider than the viewport. */}
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-3 md:px-6">
              <div className="flex min-w-0 flex-auto items-center gap-2 sm:gap-3">
                <Button
                  id="mobile-menu-button"
                  variant="secondary"
                  className="shrink-0 lg:hidden"
                  aria-expanded={mobileOpen}
                  aria-controls="mobile-sidebar"
                  onClick={() => setMobileOpen((open) => !open)}
                >
                  Menu
                </Button>
                <StoreSelector />
                <ViewStoreLink />
              </div>
              <div className="ml-auto flex min-w-0 items-center gap-3">
                <button
                  type="button"
                  className="hidden shrink-0 rounded-md border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-muted)] sm:inline-flex"
                  aria-label="Notifications (coming soon)"
                  title="Notifications coming soon"
                >
                  Alerts
                </button>
                <div className="min-w-0 max-w-[14rem] text-right lg:max-w-[12rem] xl:max-w-[14rem]">
                  <p className="truncate text-sm font-medium" title={displayName}>
                    {displayName}
                  </p>
                  <p className="truncate text-xs text-[var(--color-muted)]" title={user.email}>
                    {user.email}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  className="shrink-0"
                  onClick={() => {
                    void confirmLeave().then(async (ok) => {
                      if (!ok) return;
                      await logout();
                      router.replace('/login');
                    });
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

          <main className="flex-1 px-4 py-6 md:px-6">
            {/* Page content stops growing at 1400px and stays centred on wide screens. */}
            <div className="mx-auto w-full max-w-[1400px]">
              <EmailVerificationBanner />
              <SubscriptionGate pathname={pathname}>{children}</SubscriptionGate>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
