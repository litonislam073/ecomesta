'use client';

import { useRouter } from 'next/navigation';

/** "Sort by" that applies at once, like the design (each option has its own link). */
export function KenakataSortSelect({
  value,
  options,
  hrefs,
}: {
  value: string;
  options: { value: string; label: string }[];
  hrefs: Record<string, string>;
}) {
  const router = useRouter();
  return (
    <label className="flex items-center gap-3 text-[15px] font-medium text-[var(--color-ink)]">
      Sort by
      <select
        value={value}
        onChange={(event) => {
          const next = hrefs[event.target.value];
          if (next) router.push(next);
        }}
        className="h-11 rounded-xl border border-[var(--color-border)] bg-white px-3.5"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
