import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';

export type AnimatedTag =
  | 'div'
  | 'section'
  | 'article'
  | 'aside'
  | 'header'
  | 'figure'
  | 'ul'
  | 'ol'
  | 'li'
  | 'p'
  | 'span'
  | 'h1'
  | 'h2';

export type AnimatedElementProps = Omit<HTMLAttributes<HTMLElement>, 'children'> & {
  as?: AnimatedTag;
  children?: ReactNode;
  className?: string;
};

export type RevealDirection = 'up' | 'down' | 'left' | 'right' | 'none';

export const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];

/** Elements whose top edge passes this line (10% above the viewport bottom) are revealed. */
export const REVEAL_ROOT_MARGIN = '0px 0px -10% 0px';

/**
 * Animations are an enhancement: without IntersectionObserver, the Web Animations API
 * or with reduced motion requested, content simply stays in its final visible state.
 */
export function motionAllowed(): boolean {
  if (
    typeof window === 'undefined' ||
    typeof IntersectionObserver === 'undefined' ||
    typeof window.matchMedia !== 'function' ||
    typeof Element.prototype.animate !== 'function'
  ) {
    return false;
  }
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function isCompactViewport(): boolean {
  return window.matchMedia('(max-width: 767px)').matches;
}

/**
 * Only content that has not been seen yet is hidden, so server-rendered content that is
 * already on screen at hydration never flashes or disappears.
 */
export function isBelowFold(element: Element): boolean {
  return element.getBoundingClientRect().top >= window.innerHeight;
}

export function revealTransform(
  direction: RevealDirection,
  distance: number,
  scale?: number,
): string {
  const offsets: Record<RevealDirection, [number, number]> = {
    up: [0, distance],
    down: [0, -distance],
    left: [-distance, 0],
    right: [distance, 0],
    none: [0, 0],
  };
  const [x, y] = offsets[direction];
  const translate = `translate3d(${x}px, ${y}px, 0)`;
  return scale === undefined || scale === 1 ? translate : `${translate} scale(${scale})`;
}

/** Phones get shorter, vertical-only movement and no scale. */
export function compactDirection(direction: RevealDirection): RevealDirection {
  return direction === 'left' || direction === 'right' ? 'up' : direction;
}

export function hideForReveal(element: HTMLElement, transform: string): void {
  element.style.opacity = '0';
  element.style.transform = transform;
}

/** Hands the element back to its stylesheet (hover transforms included). */
export function clearRevealStyles(element: HTMLElement): void {
  element.style.removeProperty('opacity');
  element.style.removeProperty('transform');
}

export function enterStyle({
  direction,
  distance,
  scale,
  delay,
  duration,
  style,
}: {
  direction: RevealDirection;
  distance: number;
  scale?: number;
  delay: number;
  duration: number;
  style?: CSSProperties;
}): CSSProperties {
  return {
    ...style,
    ['--em-from-lg' as string]: revealTransform(direction, distance, scale),
    ['--em-from-sm' as string]: revealTransform(compactDirection(direction), Math.round(distance / 2)),
    ['--em-delay' as string]: `${Math.round(delay * 1000)}ms`,
    ['--em-duration' as string]: `${Math.round(duration * 1000)}ms`,
  };
}
