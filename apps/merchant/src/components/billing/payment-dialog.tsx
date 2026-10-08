'use client';

import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * The payment step as a modal over the plan. Escape, the close button and a
 * click on the backdrop close it; focus stays inside while it is open.
 * Rendered into <body> so no page layout (sticky headers, stacking contexts)
 * can sit above the backdrop.
 */
export function PaymentDialog({
  active,
  title,
  subtitle,
  headingRef,
  onClose,
  children,
}: {
  /** False while the store is being created: the dialog stays mounted but hidden. */
  active: boolean;
  title: string;
  subtitle: ReactNode;
  headingRef: RefObject<HTMLHeadingElement>;
  onClose: () => void;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!active) return;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;
      const items = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (items.length === 0) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      const inside = panelRef.current.contains(document.activeElement);
      if (event.shiftKey && (document.activeElement === first || !inside)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !inside)) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [active]);

  if (typeof document === 'undefined') return null;
  return createPortal(
    <div
      // Inactive (the store is being created): kept mounted, so what was typed survives, but hidden.
      hidden={!active}
      className={`fixed inset-0 z-[100] ${active ? 'flex' : 'hidden'} items-start justify-center overflow-y-auto bg-[rgba(2,20,43,0.55)] px-3 py-4 backdrop-blur-[2px] sm:items-center sm:px-6 sm:py-8`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-heading"
        className="relative my-auto w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl sm:p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2
              id="payment-heading"
              ref={headingRef}
              tabIndex={-1}
              className="text-xl font-semibold tracking-tight text-[var(--color-ink)] focus:outline-none"
            >
              {title}
            </h2>
            <p className="mt-0.5 text-sm text-[var(--color-muted)]">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close payment"
            className="-mr-1 -mt-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-2xl leading-none text-[var(--color-muted)] hover:bg-[#f1f4f7] hover:text-[var(--color-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
