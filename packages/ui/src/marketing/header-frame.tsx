'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Sticky marketing header that gains a soft shadow once the page is scrolled.
 * Scroll state comes from an IntersectionObserver on a sentinel at the top of the
 * document, so there is no scroll listener and the header height never changes.
 */
export function MarketingHeaderFrame({ children }: { children: ReactNode }) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || typeof IntersectionObserver === 'undefined') {
      return;
    }
    const observer = new IntersectionObserver(([entry]) => setScrolled(!entry?.isIntersecting));
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <div ref={sentinelRef} aria-hidden="true" className="pointer-events-none absolute left-0 top-0 h-2 w-px" />
      <header
        data-scrolled={scrolled ? '' : undefined}
        className="sticky top-0 z-40 border-b border-[var(--color-border)] bg-white/90 backdrop-blur transition-[background-color,box-shadow] duration-200 ease-out supports-[backdrop-filter]:bg-white/75 data-[scrolled]:shadow-[0_8px_24px_-16px_rgba(16,35,30,0.28)] supports-[backdrop-filter]:data-[scrolled]:bg-white/85"
      >
        {children}
      </header>
    </>
  );
}
