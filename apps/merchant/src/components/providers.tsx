'use client';

import type { ReactNode } from 'react';
import { AuthProvider } from '@/lib/auth-context';
import { StoreProvider } from '@/lib/store-context';
import { ToastProvider } from '@/components/ui/toast';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <StoreProvider>
        <ToastProvider>{children}</ToastProvider>
      </StoreProvider>
    </AuthProvider>
  );
}
