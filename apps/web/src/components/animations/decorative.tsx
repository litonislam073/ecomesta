import { createElement, type ReactElement, type ReactNode } from 'react';
import type { AnimatedElementProps } from './motion-utils';

/**
 * Slow, small vertical drift for decorative elements only. CSS-driven; disabled on
 * phones and when reduced motion is requested.
 */
export function Floating({
  as = 'div',
  children,
  className = '',
  delay = 0,
  style,
  ...rest
}: AnimatedElementProps & { delay?: number }): ReactElement {
  return createElement(
    as,
    {
      ...rest,
      className: `em-float ${className}`.trim(),
      style: { ...style, ['--em-delay' as string]: `${Math.round(delay * 1000)}ms` },
    },
    children,
  );
}

export const HOVER_LIFT_CLASS = 'em-hover-lift';
/** Put on an icon inside a `HoverLift` card to nudge it on hover. */
export const HOVER_ICON_CLASS = 'em-hover-icon';

/** Lifts a card slightly on hover (pointer devices only) with a soft shadow. */
export function HoverLift({ as = 'div', children, className = '', ...rest }: AnimatedElementProps): ReactElement {
  return createElement(as, { ...rest, className: `${HOVER_LIFT_CLASS} ${className}`.trim() }, children);
}

/**
 * Short opacity fade for route content. Used from an App Router `template`, which
 * remounts on navigation, so it needs no client JavaScript.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  return <div className="em-page-in">{children}</div>;
}
