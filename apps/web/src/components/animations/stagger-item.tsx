import { createElement, type ReactElement } from 'react';
import type { AnimatedElementProps } from './motion-utils';

/** Direct child of `StaggerContainer`. Renders on the server; the container animates it. */
export function StaggerItem({ as = 'div', children, ...rest }: AnimatedElementProps): ReactElement {
  return createElement(as, { ...rest, 'data-stagger-item': '' }, children);
}
