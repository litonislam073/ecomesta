'use client';

import { createElement, useEffect, type ReactElement } from 'react';
import { useAnimate } from 'motion/react-mini';
import {
  EASE_OUT,
  REVEAL_ROOT_MARGIN,
  clearRevealStyles,
  hideForReveal,
  isBelowFold,
  isCompactViewport,
  motionAllowed,
  revealTransform,
  type AnimatedElementProps,
} from './motion-utils';

export type StaggerContainerProps = AnimatedElementProps & {
  /** Seconds between items that enter the viewport together. */
  step?: number;
  /** Item travel distance in px on desktop. */
  distance?: number;
  /** Seconds per item. */
  duration?: number;
};

/** Later items in a batch never wait longer than this many steps. */
const MAX_STEPS = 5;

/**
 * Reveals its direct `StaggerItem` children as they scroll into view. Items entering
 * together (one grid row, or the whole grid on large screens) are staggered briefly;
 * a single IntersectionObserver serves the whole group.
 */
export function StaggerContainer({
  as = 'div',
  children,
  step = 0.07,
  distance = 16,
  duration = 0.5,
  ...rest
}: StaggerContainerProps): ReactElement {
  const [scope, animate] = useAnimate<HTMLElement>();

  useEffect(() => {
    const root = scope.current;
    if (!root || !motionAllowed()) {
      return;
    }
    const items = Array.from(root.querySelectorAll<HTMLElement>(':scope > [data-stagger-item]')).filter(
      isBelowFold,
    );
    if (items.length === 0) {
      return;
    }
    const compact = isCompactViewport();
    const from = revealTransform('up', compact ? Math.round(distance * 0.6) : distance);
    items.forEach((item) => hideForReveal(item, from));

    const observer = new IntersectionObserver(
      (entries) => {
        const entering = entries
          .filter((entry) => entry.isIntersecting)
          .map((entry) => entry.target as HTMLElement)
          .sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
        entering.forEach((item, index) => {
          observer.unobserve(item);
          animate(
            item,
            { opacity: [0, 1], transform: [from, 'none'] },
            { duration, delay: Math.min(index, MAX_STEPS) * step, ease: EASE_OUT },
          ).then(() => clearRevealStyles(item));
        });
      },
      { rootMargin: REVEAL_ROOT_MARGIN },
    );
    items.forEach((item) => observer.observe(item));

    return () => {
      observer.disconnect();
      items.forEach(clearRevealStyles);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return createElement(as, { ...rest, ref: scope }, children);
}
