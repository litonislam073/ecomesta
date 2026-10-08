'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { THEME_PREVIEW_QUERY, readThemePreviewToken, withThemePreview } from '@/lib/theme-preview';

/** Messages exchanged with the merchant's theme editor (the parent window). */
export const THEME_PREVIEW_MESSAGE = 'ecomesta-theme-preview';

export const THEME_SECTION_LABELS: Record<string, string> = {
  announcement: 'Announcement bar',
  header: 'Header',
  hero: 'Hero banner',
  featured_categories: 'Categories',
  featured_products: 'Products',
  footer: 'Footer',
};

type Box = { top: number; left: number; width: number; height: number; section: string; label?: string };

function sectionOf(target: EventTarget | null): HTMLElement | null {
  return target instanceof Element ? target.closest<HTMLElement>('[data-theme-section]') : null;
}

/**
 * Runs inside the theme editor's preview frame only. It keeps navigation in
 * the preview, refreshes when the editor's draft changes, and lets the
 * merchant pick a section on the page to edit it.
 */
export function ThemePreviewBridge() {
  const router = useRouter();
  const pathname = usePathname();
  const [box, setBox] = useState<Box | null>(null);
  const hovered = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const token = readThemePreviewToken(new URLSearchParams(window.location.search).get(THEME_PREVIEW_QUERY));
    if (!token) return;
    const embedded = window.parent !== window;

    let focusTimer: number | undefined;

    // Same-site links stay in the preview (Next links included: this runs first).
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest('a') : null;
      if (!anchor || !anchor.href || (anchor.target && anchor.target !== '_self') || anchor.hasAttribute('download')) return;
      const url = new URL(anchor.href);
      if (url.origin !== window.location.origin || url.searchParams.get(THEME_PREVIEW_QUERY) === token) return;
      event.preventDefault();
      event.stopPropagation();
      router.push(withThemePreview(`${url.pathname}${url.search}${url.hash}`, token));
    };
    document.addEventListener('click', onClick, true);

    const onMessage = (event: MessageEvent) => {
      if (event.source !== window.parent || event.data?.type !== THEME_PREVIEW_MESSAGE) return;
      if (event.data.action === 'refresh') router.refresh();
      if (event.data.action === 'focus' && typeof event.data.section === 'string') {
        // A section just added appears after the next refresh: keep looking briefly.
        const selector = `[data-theme-section="${CSS.escape(event.data.section)}"]`;
        window.clearInterval(focusTimer);
        let tries = 0;
        const find = () => {
          const el = document.querySelector<HTMLElement>(selector);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          if (el || ++tries > 15) window.clearInterval(focusTimer);
          return el;
        };
        if (!find()) focusTimer = window.setInterval(find, 200);
      }
    };
    window.addEventListener('message', onMessage);

    if (!embedded) {
      return () => {
        document.removeEventListener('click', onClick, true);
        window.removeEventListener('message', onMessage);
      };
    }

    // Hover outline + "Edit" chip for the section under the pointer.
    const measure = () => {
      const el = hovered.current;
      if (!el || !el.isConnected) return setBox(null);
      const rect = el.getBoundingClientRect();
      setBox({ top: rect.top, left: rect.left, width: rect.width, height: rect.height, section: el.dataset.themeSection ?? '', label: el.dataset.themeSectionLabel });
    };
    const onOver = (event: MouseEvent) => {
      // The Edit chip sits over the section it belongs to.
      if (event.target instanceof Element && event.target.closest('[data-theme-preview-chip]')) return;
      const el = sectionOf(event.target);
      if (el === hovered.current) return;
      hovered.current = el;
      measure();
    };
    const onLeave = () => {
      hovered.current = null;
      setBox(null);
    };
    document.addEventListener('mouseover', onOver);
    document.documentElement.addEventListener('mouseleave', onLeave);
    window.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure);
    return () => {
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('message', onMessage);
      window.clearInterval(focusTimer);
      document.removeEventListener('mouseover', onOver);
      document.documentElement.removeEventListener('mouseleave', onLeave);
      window.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
    };
  }, [router]);

  // Tell the editor which page the preview is on (also after in-preview navigation).
  useEffect(() => {
    const token = readThemePreviewToken(new URLSearchParams(window.location.search).get(THEME_PREVIEW_QUERY));
    if (token && window.parent !== window) {
      window.parent.postMessage({ type: THEME_PREVIEW_MESSAGE, action: 'ready', path: pathname }, '*');
    }
  }, [pathname]);

  if (!box) return null;
  const label = box.label ?? THEME_SECTION_LABELS[box.section] ?? box.section;
  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none fixed z-[200] rounded-sm"
        style={{ top: box.top, left: box.left, width: box.width, height: box.height, boxShadow: 'inset 0 0 0 2px #2563eb' }}
      />
      <button
        type="button"
        data-theme-preview-chip=""
        className="fixed z-[201] rounded-b-md bg-[#2563eb] px-2.5 py-1 text-xs font-semibold text-white shadow"
        style={{ top: Math.max(box.top, 0), left: box.left }}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => window.parent.postMessage({ type: THEME_PREVIEW_MESSAGE, action: 'select', section: box.section }, '*')}
      >
        Edit {label}
      </button>
    </>
  );
}
