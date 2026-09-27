import { createElement, type ReactElement } from 'react';
import { enterStyle, type RevealDirection } from './motion-utils';
import { Reveal, type RevealProps } from './reveal';

export type FadeProps = Omit<RevealProps, 'direction'> & {
  /**
   * `view` (default) animates once when scrolled into view.
   * `load` is a CSS-only entrance for above-the-fold content: it needs no JavaScript,
   * so it plays on first paint and never delays hydration or the largest paint.
   */
  on?: 'view' | 'load';
};

function Fade({
  on = 'view',
  direction,
  ...props
}: FadeProps & { direction: RevealDirection }): ReactElement {
  if (on === 'view') {
    return <Reveal direction={direction} {...props} />;
  }
  const {
    as = 'div',
    children,
    className = '',
    distance = 20,
    scale,
    delay = 0,
    duration = 0.6,
    style,
    ...rest
  } = props;
  return createElement(
    as,
    {
      ...rest,
      className: `em-enter ${className}`.trim(),
      style: enterStyle({ direction, distance, scale, delay, duration, style }),
    },
    children,
  );
}

export function FadeIn(props: FadeProps) {
  return <Fade direction="none" {...props} />;
}

export function FadeUp(props: FadeProps) {
  return <Fade direction="up" {...props} />;
}

export function FadeDown(props: FadeProps) {
  return <Fade direction="down" {...props} />;
}

/** Enters from the left. Phones use a short vertical fade instead. */
export function FadeLeft(props: FadeProps) {
  return <Fade direction="left" {...props} />;
}

/** Enters from the right. Phones use a short vertical fade instead. */
export function FadeRight(props: FadeProps) {
  return <Fade direction="right" {...props} />;
}

export function ScaleIn({ scale = 0.96, distance = 12, duration = 0.8, ...props }: FadeProps) {
  return <Fade direction="up" scale={scale} distance={distance} duration={duration} {...props} />;
}
