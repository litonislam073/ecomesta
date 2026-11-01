'use client';

import type { ReactNode } from 'react';
import { SignupAttributionCapture } from '@/components/signup-attribution-capture';
import { AuthProvider } from '@/lib/auth-context';
import { StoreProvider } from '@/lib/store-context';
import { ToastProvider } from '@/components/ui/toast';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <StoreProvider>
        <ToastProvider>
          <SignupAttributionCapture />
          {children}
        </ToastProvider>
      </StoreProvider>
    </AuthProvider>
  );
}
