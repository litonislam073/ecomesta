'use client';

import { useMemo, useState } from 'react';
import { dayLabel, monthYearLabel } from '@/lib/analytics';

export interface ChartPoint {
  date: string;
  value: number;
}

/** Long ranges are shown by week so each bar stays readable. */
export function groupByWeek(points: ChartPoint[]): ChartPoint[] {
  if (points.length <= 92) return points;
  const weeks: ChartPoint[] = [];
  for (let i = 0; i < points.length; i += 7) {
    const chunk = points.slice(i, i + 7);
    weeks.push({ date: chunk[0]!.date, value: chunk.reduce((sum, p) => sum + p.value, 0) });
  }
  return weeks;
}

/**
 * Bars per day (or week) with a hover/focus readout. Plain SVG, no chart
 * library: the numbers are also in the table for screen readers.
 */
export function BarChart({
  points,
  format,
  label,
  height = 220,
}: {
  points: ChartPoint[];
  format: (value: number) => string;
  label: string;
  height?: number;
}) {
  const data = useMemo(() => groupByWeek(points), [points]);
  const weekly = data.length !== points.length;
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((p) => p.value));
  const width = 1000;
  const gap = data.length > 60 ? 1 : data.length > 20 ? 3 : 8;
  const barWidth = Math.max(1, (width - gap * (data.length - 1)) / Math.max(1, data.length));
  const shown = active == null ? null : data[active];
  const total = data.reduce((sum, p) => sum + p.value, 0);
  // Long ranges (more than ~2 months) get evenly spaced month + year ticks.
  const longRange = points.length > 60;
  const ticks = longRange
    ? Array.from({ length: 5 }, (_, k) => Math.round((k * (data.length - 1)) / 4))
    : data.length <= 7
      ? data.map((_, i) => i)
      : [0, Math.floor((data.length - 1) / 2), data.length - 1];
  const tickLabel = (date: string) => (longRange ? monthYearLabel(date) : dayLabel(date));

  return (
    <figure className="space-y-2">
      <div className="flex min-h-6 items-baseline justify-between gap-3 text-sm">
        <span className="text-[var(--color-muted)]">
          {shown ? `${weekly ? 'Week of ' : ''}${dayLabel(shown.date)}` : `Total ${label.toLowerCase()}`}
        </span>
        <span className="font-semibold tabular-nums">{format(shown ? shown.value : total)}</span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="block h-48 w-full sm:h-56"
        role="img"
        aria-label={`${label} by ${weekly ? 'week' : 'day'}`}
        onMouseLeave={() => setActive(null)}
      >
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={0} x2={width} y1={height * f} y2={height * f} stroke="var(--color-border)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        ))}
        {data.map((p, i) => {
          const h = p.value === 0 ? 2 : Math.max(3, (p.value / max) * (height - 8));
          return (
            <rect
              key={p.date}
              x={i * (barWidth + gap)}
              y={height - h}
              width={barWidth}
              height={h}
              rx={barWidth > 8 ? 3 : 0}
              fill={p.value === 0 ? 'var(--color-border)' : 'var(--color-accent)'}
              opacity={active == null || active === i ? 1 : 0.45}
              onMouseEnter={() => setActive(i)}
            />
          );
        })}
      </svg>
      <div className="relative h-4 text-[11px] text-[var(--color-muted)]">
        {ticks.map((i) => (
          <span
            key={i}
            className="absolute -translate-x-1/2 whitespace-nowrap first:translate-x-0 last:-translate-x-full"
            style={{ left: `${data.length <= 1 ? 0 : (i / (data.length - 1)) * 100}%` }}
          >
            {tickLabel(data[i]!.date)}
          </span>
        ))}
      </div>
      <figcaption className="sr-only">
        {data.map((p) => `${dayLabel(p.date)}: ${format(p.value)}`).join('; ')}
      </figcaption>
    </figure>
  );
}

/** Ranked rows with a proportional bar, e.g. traffic sources or devices. */
export function BarList({
  rows,
  format = (v) => String(v),
  empty,
}: {
  rows: { label: string; value: number; hint?: string }[];
  format?: (value: number) => string;
  empty: string;
}) {
  if (rows.length === 0) return <p className="text-sm text-[var(--color-muted)]">{empty}</p>;
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-2">
      {rows.map((row) => (
        <li key={row.label} className="relative overflow-hidden rounded-md">
          <span
            aria-hidden="true"
            className="absolute inset-y-0 left-0 rounded-md bg-[#e3f4ec]"
            style={{ width: `${Math.max(2, (row.value / max) * 100)}%` }}
          />
          <span className="relative flex items-center justify-between gap-3 px-2.5 py-1.5 text-sm">
            <span className="min-w-0 truncate" title={row.label}>
              {row.label}
              {row.hint ? <span className="ml-1.5 text-xs text-[var(--color-muted)]">{row.hint}</span> : null}
            </span>
            <span className="shrink-0 font-semibold tabular-nums">{format(row.value)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
