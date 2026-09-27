'use client';

import { useRef, type MouseEvent, type ReactNode } from 'react';
import { useAnimate } from 'motion/react-mini';
import { EASE_OUT } from './motion-utils';

type Controls = ReturnType<ReturnType<typeof useAnimate>[1]>;

function accordionMotionAllowed(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    typeof Element.prototype.animate === 'function' &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * A native `<details>` disclosure (works without JavaScript, searchable with find-in-page)
 * whose open and close are animated by measured height and opacity. While closing,
 * `data-closing` is set so styles keyed on `[open]` can already show the closed state.
 */
export function AccordionItem({
  summary,
  children,
  className,
  summaryClassName,
}: {
  summary: ReactNode;
  children: ReactNode;
  className?: string;
  summaryClassName?: string;
}) {
  const [scope, animate] = useAnimate<HTMLDetailsElement>();
  const contentRef = useRef<HTMLDivElement>(null);
  const running = useRef<Controls | null>(null);

  function settle(content: HTMLDivElement) {
    running.current = null;
    content.style.removeProperty('height');
    content.style.removeProperty('opacity');
    content.style.removeProperty('overflow');
  }

  function onSummaryClick(event: MouseEvent<HTMLElement>) {
    const details = scope.current;
    const content = contentRef.current;
    if (!details || !content || !accordionMotionAllowed()) {
      return;
    }
    event.preventDefault();
    const currentHeight = content.getBoundingClientRect().height;
    const currentOpacity = Number(getComputedStyle(content).opacity);
    running.current?.stop();
    content.style.overflow = 'hidden';

    const closing = details.open && !details.hasAttribute('data-closing');
    if (closing) {
      details.setAttribute('data-closing', '');
      const controls = animate(
        content,
        { height: [`${currentHeight}px`, '0px'], opacity: [currentOpacity, 0] },
        { duration: 0.22, ease: EASE_OUT },
      );
      running.current = controls;
      void controls.then(() => {
        if (running.current !== controls) return;
        details.open = false;
        details.removeAttribute('data-closing');
        settle(content);
      });
      return;
    }

    const reopening = details.hasAttribute('data-closing');
    details.removeAttribute('data-closing');
    details.open = true;
    content.style.removeProperty('height');
    const target = content.scrollHeight;
    const controls = animate(
      content,
      {
        height: [`${reopening ? currentHeight : 0}px`, `${target}px`],
        opacity: [reopening ? currentOpacity : 0, 1],
      },
      { duration: 0.28, ease: EASE_OUT },
    );
    running.current = controls;
    void controls.then(() => {
      if (running.current === controls) settle(content);
    });
  }

  return (
    <details ref={scope} className={className}>
      <summary className={summaryClassName} onClick={onSummaryClick}>
        {summary}
      </summary>
      <div ref={contentRef}>{children}</div>
    </details>
  );
}
