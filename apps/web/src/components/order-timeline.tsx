'use client';

import type { OrderTimelineEvent } from '@ecomesta/types';

export function OrderTimeline({
  events,
  emptyLabel = 'No timeline events yet.',
}: {
  events: OrderTimelineEvent[];
  emptyLabel?: string;
}) {
  if (!events.length) {
    return <p className="text-sm text-[var(--color-muted)]">{emptyLabel}</p>;
  }

  return (
    <ol className="relative space-y-4 border-l border-[var(--color-border)] pl-5">
      {events.map((event, index) => (
        <li key={`${event.type}-${event.occurredAt}-${index}`} className="relative">
          <span
            className="absolute -left-[1.4rem] top-1.5 h-2.5 w-2.5 rounded-full bg-[var(--color-accent)]"
            aria-hidden
          />
          <p className="text-sm font-semibold text-[var(--color-ink)]">{event.label}</p>
          <p className="text-sm text-[var(--color-muted)]">{event.description}</p>
          <time
            className="mt-1 block text-xs text-[var(--color-muted)]"
            dateTime={event.occurredAt}
          >
            {new Date(event.occurredAt).toLocaleString()}
          </time>
        </li>
      ))}
    </ol>
  );
}
