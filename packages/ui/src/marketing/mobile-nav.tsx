'use client';

import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';
import type { NavItem } from './nav';

export function MobileNav({
  items,
  loginHref,
  registerHref,
}: {
  items: NavItem[];
  loginHref: string;
  registerHref: string;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div className="lg:hidden">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? 'Close menu' : 'Open menu'}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--color-border)] bg-white text-[var(--color-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
      </button>

      <div
        id={panelId}
        aria-hidden={!open}
        className={`absolute inset-x-0 top-full border-b border-[var(--color-border)] bg-white shadow-lg transition-[opacity,transform,visibility] duration-200 ease-out motion-reduce:transition-none ${
          open ? 'visible translate-y-0 opacity-100' : 'pointer-events-none invisible -translate-y-2 opacity-0'
        }`}
      >
        <nav aria-label="Mobile" className="mx-auto max-w-[1200px] px-4 py-4 sm:px-6">
          <ul className="space-y-1">
            {items.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={close}
                  className="block rounded-lg px-3 py-3 text-base font-medium text-[var(--color-ink)] hover:bg-[var(--color-bg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-4 grid gap-2 border-t border-[var(--color-border)] pt-4 sm:grid-cols-2">
            <a
              href={loginHref}
              className="rounded-lg border border-[var(--color-border)] px-4 py-3 text-center font-semibold text-[var(--color-ink)]"
            >
              Login
            </a>
            <a
              href={registerHref}
              data-cta="create-store-mobile-nav"
              className="rounded-lg bg-[var(--color-accent)] px-4 py-3 text-center font-semibold text-white"
            >
              Create Your Store
            </a>
          </div>
        </nav>
      </div>
    </div>
  );
}
