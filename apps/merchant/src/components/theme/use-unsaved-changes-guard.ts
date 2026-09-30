'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { registerLeaveGuard } from '@/lib/leave-guard';

export type DiscardPrompt = {
  /** What the dialog is guarding, e.g. "leave" or "switch". */
  reason: 'leave' | 'switch';
  confirm: () => void;
  cancel: () => void;
} | null;

/**
 * Protects unsaved Theme editor edits while `dirty` is true.
 *
 * - Reload, tab close and typed URLs: the browser's own `beforeunload` prompt.
 * - In-app links: a capture-phase click listener on this page intercepts
 *   internal `<a>` navigation and asks first (the App Router has no blocking
 *   API).
 * - Back/Forward: a copy of the current history entry is pushed while dirty, so
 *   Back first lands on the same page; that `popstate` is stopped before the
 *   router sees it and the merchant is asked.
 * - Store switch / log out: shell actions call `confirmLeave()`.
 *
 * Nothing is registered while the editor is clean.
 */
export function useUnsavedChangesGuard(dirty: boolean) {
  const router = useRouter();
  const [prompt, setPrompt] = useState<DiscardPrompt>(null);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  // True while our extra history entry is the current one.
  const guardEntry = useRef(false);

  /** Asks whether to discard the unsaved edits; resolves true to discard. */
  const askDiscard = useCallback(
    (reason: 'leave' | 'switch' = 'leave') =>
      new Promise<boolean>((resolve) => {
        setPrompt({
          reason,
          confirm: () => {
            setPrompt(null);
            resolve(true);
          },
          cancel: () => {
            setPrompt(null);
            resolve(false);
          },
        });
      }),
    [],
  );

  // Browser-level navigation: reload, close, typed URL, external links.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  // In-app links (sidebar, header, anything rendered as <a href>).
  useEffect(() => {
    if (!dirty) return;
    const onClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      const anchor = (event.target as Element | null)?.closest?.('a[href]');
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if ((anchor.target && anchor.target !== '_self') || anchor.hasAttribute('download')) return;
      const url = new URL(anchor.href, window.location.href);
      // Other sites unload the page, which `beforeunload` already covers.
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;

      event.preventDefault();
      event.stopPropagation();
      void askDiscard('leave').then((discard) => {
        if (!discard) return;
        const href = `${url.pathname}${url.search}${url.hash}`;
        // Replace our extra entry rather than stacking the new page on top of it.
        if (guardEntry.current) {
          guardEntry.current = false;
          router.replace(href);
        } else {
          router.push(href);
        }
      });
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [dirty, askDiscard, router]);

  // Back/Forward.
  useEffect(() => {
    if (!dirty) return;
    if (!guardEntry.current) {
      window.history.pushState(window.history.state, '', window.location.href);
      guardEntry.current = true;
    }
    const onPopState = (event: PopStateEvent) => {
      if (!guardEntry.current) return;
      // Back left our extra entry and landed on this same page: hold it here.
      guardEntry.current = false;
      event.stopImmediatePropagation();
      void askDiscard('leave').then((discard) => {
        if (discard) {
          window.history.back();
        } else if (dirtyRef.current) {
          window.history.pushState(window.history.state, '', window.location.href);
          guardEntry.current = true;
        }
      });
    };
    window.addEventListener('popstate', onPopState, true);
    return () => window.removeEventListener('popstate', onPopState, true);
  }, [dirty, askDiscard]);

  // Clean again (saved, reset, changed back): drop the extra history entry.
  useEffect(() => {
    if (dirty || !guardEntry.current) return;
    guardEntry.current = false;
    const swallow = (event: PopStateEvent) => {
      event.stopImmediatePropagation();
      window.removeEventListener('popstate', swallow, true);
    };
    window.addEventListener('popstate', swallow, true);
    window.history.back();
  }, [dirty]);

  // Shell actions without a link (store switch, log out).
  useEffect(
    () =>
      registerLeaveGuard(() =>
        dirtyRef.current ? askDiscard('leave') : Promise.resolve(true),
      ),
    [askDiscard],
  );

  return { prompt, askDiscard };
}
