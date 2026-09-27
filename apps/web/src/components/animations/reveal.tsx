'use client';

import { createElement, useEffect, type ReactElement } from 'react';
import { useAnimate } from 'motion/react-mini';
import {
  EASE_OUT,
  REVEAL_ROOT_MARGIN,
  clearRevealStyles,
  compactDirection,
  hideForReveal,
  isBelowFold,
  isCompactViewport,
  motionAllowed,
  revealTransform,
  type AnimatedElementProps,
  type RevealDirection,
} from './motion-utils';

export type RevealProps = AnimatedElementProps & {
  direction?: RevealDirection;
  /** Travel distance in px on desktop; halved on phones. */
  distance?: number;
  /** Starting scale on desktop, e.g. 0.97. Ignored on phones. */
  scale?: number;
  /** Seconds. */
  delay?: number;
  /** Seconds. */
  duration?: number;
};

/**
 * Fades its content in once when it scrolls into view. The server HTML is always the
 * final, visible state; content is only hidden after hydration if it is still below the fold.
 */
export function Reveal({
  as = 'div',
  children,
  direction = 'up',
  distance = 24,
  scale,
  delay = 0,
  duration = 0.6,
  ...rest
}: RevealProps): ReactElement {
  const [scope, animate] = useAnimate<HTMLElement>();

  useEffect(() => {
    const element = scope.current;
    if (!element || !motionAllowed() || !isBelowFold(element)) {
      return;
    }
    const compact = isCompactViewport();
    const from = compact
      ? revealTransform(compactDirection(direction), Math.round(distance / 2))
      : revealTransform(direction, distance, scale);
    hideForReveal(element, from);

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) {
          return;
        }
        observer.disconnect();
        animate(
          element,
          { opacity: [0, 1], transform: [from, 'none'] },
          { duration: compact ? duration * 0.8 : duration, delay, ease: EASE_OUT },
        ).then(() => clearRevealStyles(element));
      },
      { rootMargin: REVEAL_ROOT_MARGIN },
    );
    observer.observe(element);

    return () => {
      observer.disconnect();
      clearRevealStyles(element);
    };
    // Runs once per mount: reveal settings are static for a rendered section.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return createElement(as, { ...rest, ref: scope }, children);
}
