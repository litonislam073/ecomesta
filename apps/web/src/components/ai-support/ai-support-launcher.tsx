'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';
import { isAiSupportHost } from '@/lib/ai-support';

// The chat panel is only downloaded when a visitor shows interest in it.
const AiSupportPanel = dynamic(() => import('./ai-support-panel').then((mod) => mod.AiSupportPanel), {
  ssr: false,
  loading: () => null,
});

export function ChatIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className} aria-hidden="true">
      <path
        d="M20 12a7.5 7.5 0 0 1-11.1 6.6L4 20l1.4-4.6A7.5 7.5 0 1 1 20 12z"
        strokeLinejoin="round"
      />
      <path d="M8.5 12h.01M12 12h.01M15.5 12h.01" strokeLinecap="round" strokeWidth={2.4} />
    </svg>
  );
}

/**
 * Floating "Chat with us" support button for the platform website. Renders nothing on
 * the server (no SEO content, no layout shift) and nothing on any host that is
 * not the Ecomesta platform site — merchant storefronts never get it.
 */
export function AiSupportLauncher() {
  const [allowed, setAllowed] = useState(false);
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setAllowed(isAiSupportHost(window.location.hostname));
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    window.requestAnimationFrame(() => buttonRef.current?.focus());
  }, []);

  if (!allowed) return null;

  return (
    <div data-ai-support="" className="ai-support-root">
      {open ? null : (
        <button
          ref={buttonRef}
          type="button"
          aria-label="Open Ecomesta support chat"
          aria-haspopup="dialog"
          onMouseEnter={() => setLoaded(true)}
          onFocus={() => setLoaded(true)}
          onClick={() => {
            setLoaded(true);
            setOpen(true);
          }}
          className="fixed bottom-4 right-4 z-[60] inline-flex h-12 items-center gap-2 rounded-full bg-[#0f3d30] pl-3 pr-4 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(15,61,48,0.35)] transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f3d30] sm:bottom-6 sm:right-6"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15">
            <ChatIcon className="h-[18px] w-[18px]" />
          </span>
          Chat with us
        </button>
      )}
      {loaded ? <AiSupportPanel open={open} onClose={close} /> : null}
    </div>
  );
}
