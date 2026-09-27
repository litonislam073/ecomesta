'use client';

import type { ThemeListItem } from '@ecomesta/types';
import { Button } from '@ecomesta/ui';
import { Card } from '@/components/ui/card';

export function ThemeSelector({
  themes,
  selectedThemeId,
  onSelect,
  disabled,
  busyThemeId,
}: {
  themes: ThemeListItem[];
  selectedThemeId: string | null;
  onSelect: (themeId: string) => void;
  disabled?: boolean;
  busyThemeId?: string | null;
}) {
  return (
    <Card
      title="Theme"
      description="Switching themes keeps any draft you already saved for that theme."
    >
      {themes.length === 0 ? (
        <p className="text-sm text-[var(--color-muted)]">
          No themes are available for this store yet.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {themes.map((theme) => {
            const selected = theme.id === selectedThemeId;
            return (
              <li
                key={theme.id}
                className={`rounded-lg border p-4 ${
                  selected
                    ? 'border-[var(--color-accent)] bg-[#f2f8f6]'
                    : 'border-[var(--color-border)]'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-[var(--color-ink)]">{theme.name}</p>
                    <p className="text-xs text-[var(--color-muted)]">
                      v{theme.version} · {theme.slug}
                    </p>
                  </div>
                  {selected ? (
                    <span className="rounded-full bg-[var(--color-accent)] px-2 py-0.5 text-[10px] uppercase tracking-wide text-white">
                      Selected
                    </span>
                  ) : null}
                </div>
                {theme.description ? (
                  <p className="mt-2 text-sm text-[var(--color-muted)]">
                    {theme.description}
                  </p>
                ) : null}
                {!selected && !disabled ? (
                  <Button
                    className="mt-3"
                    variant="secondary"
                    disabled={busyThemeId === theme.id}
                    onClick={() => onSelect(theme.id)}
                  >
                    {busyThemeId === theme.id ? 'Applying…' : `Use ${theme.name}`}
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
