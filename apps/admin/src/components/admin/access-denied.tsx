'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@ecomesta/ui';
import { useAuth } from '@/lib/auth-context';

/**
 * Terminal state for signed-in accounts without the SUPER_ADMIN platform role.
 * Signing out is the only way forward so no admin data is ever rendered.
 */
export function AccessDenied({ email }: { email: string }) {
  const { logout } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div
        role="alert"
        className="w-full max-w-md rounded-xl border border-[var(--color-danger)]/30 bg-[var(--color-surface)] p-8 shadow-sm"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/ecomesta-logo.png" alt="Ecomesta" width={504} height={96} className="h-9 w-auto" />
        <h1 className="mt-2 text-xl font-semibold">Access denied</h1>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          {email} does not have the Super Admin platform role. The platform console is
          limited to Super Admin accounts.
        </p>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          Merchants should use the merchant dashboard instead.
        </p>
        <Button
          className="mt-6 w-full"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void logout().then(() => router.replace('/login'));
          }}
        >
          {busy ? 'Signing out…' : 'Sign out'}
        </Button>
      </div>
    </div>
  );
}
