'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api-client';

const GIS_SRC = 'https://accounts.google.com/gsi/client';

interface GoogleCredentialResponse {
  credential?: string;
}

interface GoogleAccountsId {
  initialize(options: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    ux_mode?: 'popup' | 'redirect';
    context?: 'signin' | 'signup' | 'use';
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
  }): void;
  renderButton(
    parent: HTMLElement,
    options: {
      type?: 'standard' | 'icon';
      theme?: 'outline' | 'filled_blue' | 'filled_black';
      size?: 'large' | 'medium' | 'small';
      text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
      shape?: 'rectangular' | 'pill' | 'circle' | 'square';
      logo_alignment?: 'left' | 'center';
      width?: number;
      locale?: string;
    },
  ): void;
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleAccountsId } };
  }
}

let clientIdPromise: Promise<string | null> | null = null;
let scriptPromise: Promise<void> | null = null;

function loadClientId(): Promise<string | null> {
  clientIdPromise ??= api
    .get<{ success: true; data: { google: { clientId: string } | null } }>('/auth/providers', {
      token: null,
    })
    .then((res) => res.data.google?.clientId ?? null)
    .catch(() => {
      clientIdPromise = null;
      return null;
    });
  return clientIdPromise;
}

function loadScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromise = null;
      script.remove();
      reject(new Error('Google sign-in could not load'));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

/**
 * "Continue with Google" button plus an "or" divider. Renders nothing when the
 * API has no Google client configured or Google's script cannot load.
 */
export function GoogleSignIn({
  mode,
  disabled = false,
  onCredential,
}: {
  mode: 'signin' | 'signup';
  disabled?: boolean;
  onCredential: (credential: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const callbackRef = useRef(onCredential);
  const [ready, setReady] = useState(false);

  callbackRef.current = onCredential;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const clientId = await loadClientId();
      if (!clientId || cancelled) return;
      try {
        await loadScript();
      } catch {
        return;
      }
      const container = containerRef.current;
      const gis = window.google?.accounts?.id;
      if (cancelled || !container || !gis) return;
      gis.initialize({
        client_id: clientId,
        ux_mode: 'popup',
        context: mode,
        auto_select: false,
        cancel_on_tap_outside: true,
        callback: (response) => {
          if (response.credential) callbackRef.current(response.credential);
        },
      });
      container.replaceChildren();
      gis.renderButton(container, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: mode === 'signup' ? 'signup_with' : 'continue_with',
        shape: 'rectangular',
        logo_alignment: 'center',
        width: Math.min(400, Math.max(200, Math.floor(container.clientWidth || 360))),
      });
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [mode]);

  return (
    <div hidden={!ready} className="mt-8">
      <div
        ref={containerRef}
        aria-disabled={disabled || undefined}
        className={`flex min-h-[44px] w-full justify-center ${disabled ? 'pointer-events-none opacity-60' : ''}`}
      />
      <div className="mt-6 flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
        <span className="h-px flex-1 bg-[var(--color-border)]" />
        or use email
        <span className="h-px flex-1 bg-[var(--color-border)]" />
      </div>
    </div>
  );
}
