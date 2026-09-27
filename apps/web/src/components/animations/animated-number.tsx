'use client';

import { useEffect, useRef, useState } from 'react';
import { REVEAL_ROOT_MARGIN, isBelowFold, motionAllowed } from './motion-utils';

const format = (value: number) => Math.round(value).toLocaleString('en-US');
const easeOut = (t: number) => 1 - (1 - t) ** 3;

/**
 * Counts up to a real, existing figure once when it scrolls into view. The server
 * HTML always contains only the final value, assistive technology is given the final
 * value while counting, and the width is reserved so text never reflows.
 */
export function AnimatedNumber({
  value,
  duration = 1.2,
  className = '',
}: {
  value: number;
  /** Seconds. */
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState<number | null>(null);
  const final = format(value);

  useEffect(() => {
    const element = ref.current;
    if (!element || !motionAllowed() || !isBelowFold(element)) {
      return;
    }
    let frame = 0;
    setDisplay(0);

    // A single short frame-synced tween: motion's value animator would add ~45 kB for three numbers.
    const run = () => {
      const start = performance.now();
      const tick = (now: number) => {
        const progress = Math.min(1, (now - start) / (duration * 1000));
        setDisplay(progress < 1 ? value * easeOut(progress) : null);
        if (progress < 1) {
          frame = requestAnimationFrame(tick);
        }
      };
      frame = requestAnimationFrame(tick);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          run();
        }
      },
      { rootMargin: REVEAL_ROOT_MARGIN },
    );
    observer.observe(element);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      setDisplay(null);
    };
  }, [value, duration]);

  const counting = display !== null;
  return (
    <span
      ref={ref}
      className={`inline-block text-right tabular-nums ${className}`.trim()}
      style={{ minWidth: `${final.length}ch` }}
    >
      {counting ? (
        <>
          <span aria-hidden="true">{format(display)}</span>
          <span className="sr-only">{final}</span>
        </>
      ) : (
        final
      )}
    </span>
  );
}
