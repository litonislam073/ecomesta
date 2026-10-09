'use client';

import type { ThemeListItem } from '@ecomesta/types';
import { Button } from '@ecomesta/ui';
import { formatBdt } from '@ecomesta/utils';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { ThemeThumbnail } from '@/components/theme/theme-thumbnail';

/** A premium theme this business may not use (yet): it can be bought, not edited. */
export function isLockedTheme(theme: ThemeListItem): boolean {
  return theme.access === 'locked' || theme.access === 'pending';
}

function PremiumStatus({ theme }: { theme: ThemeListItem }) {
  switch (theme.access) {
    case 'included':
      return <p className="mt-2 text-xs font-medium text-[var(--color-accent)]">✓ Included in your plan</p>;
    case 'owned':
      return <p className="mt-2 text-xs font-medium text-[var(--color-accent)]">✓ Purchased · yours to use on every store</p>;
    case 'pending':
      return (
        <p role="status" className="mt-2 rounded-md bg-[#fff7e6] px-2.5 py-1.5 text-xs text-[#8a5a00]">
          Payment under review{theme.purchase ? ` (TrxID ${theme.purchase.transactionId})` : ''}. The theme unlocks as soon as
          our team confirms it.
        </p>
      );
    case 'locked':
      return theme.purchase?.status === 'REJECTED' ? (
        <p role="alert" className="mt-2 rounded-md bg-[#fdf3ee] px-2.5 py-1.5 text-xs text-[#a3441f]">
          Your last payment was not approved
          {theme.purchase.rejectionReason ? `: ${theme.purchase.rejectionReason}` : '.'} You can pay again.
        </p>
      ) : null;
    default:
      return null;
  }
}

export function ThemeSelector({
  themes,
  selectedThemeId,
  liveThemeId = null,
  onSelect,
  disabled,
  busyThemeId,
  onBuy,
  onTry,
}: {
  themes: ThemeListItem[];
  selectedThemeId: string | null;
  liveThemeId?: string | null;
  onSelect: (themeId: string) => void;
  disabled?: boolean;
  busyThemeId?: string | null;
  /** Opens the purchase for a locked premium theme. */
  onBuy?: (theme: ThemeListItem) => void;
  /** Shows a theme the business cannot use yet in the preview (try before you buy). */
  onTry?: (theme: ThemeListItem) => void;
}) {
  return (
    <Card
      title="Theme"
      description="Selecting a theme only changes your draft. Visitors keep seeing the live theme until you publish."
    >
      {themes.length === 0 ? (
        <p className="text-sm text-[var(--color-muted)]">
          No themes are available for this store yet.
        </p>
      ) : (
        <ul className="grid gap-3">
          {themes.map((theme) => {
            const selected = theme.id === selectedThemeId;
            const live = theme.id === liveThemeId;
            return (
              <li
                key={theme.id}
                className={`rounded-lg border p-4 ${
                  selected
                    ? 'border-[var(--color-accent)] bg-[#f2f8f6]'
                    : 'border-[var(--color-border)]'
                }`}
              >
                <div className="mb-3">
                  <ThemeThumbnail theme={theme} />
                </div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-[var(--color-ink)]">{theme.name}</p>
                    <p className="text-xs text-[var(--color-muted)]">
                      v{theme.version} · {theme.slug}
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-end gap-1">
                    {theme.premium ? (
                      <span className="rounded-full bg-gradient-to-r from-[#f26522] to-[#e0891b] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                        Premium{theme.priceBdt ? ` · ${formatBdt(Number(theme.priceBdt))}` : ''}
                      </span>
                    ) : null}
                    {live ? (
                      <span className="rounded-full border border-[var(--color-accent)] px-2 py-0.5 text-[10px] uppercase tracking-wide text-[var(--color-accent)]">
                        Live
                      </span>
                    ) : null}
                    {selected ? (
                      <span className="rounded-full bg-[var(--color-accent)] px-2 py-0.5 text-[10px] uppercase tracking-wide text-white">
                        Editing
                      </span>
                    ) : null}
                  </div>
                </div>
                {theme.description ? (
                  <p className="mt-2 text-sm text-[var(--color-muted)]">
                    {theme.description}
                  </p>
                ) : null}
                {theme.premium ? <PremiumStatus theme={theme} /> : null}
                {isLockedTheme(theme) && !selected && onTry ? (
                  <Button className="mt-3 mr-2" variant="secondary" onClick={() => onTry(theme)}>
                    Preview
                  </Button>
                ) : null}
                {theme.access === 'locked' && theme.premium && !selected ? (
                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
                    {!disabled && onBuy ? (
                      <Button onClick={() => onBuy(theme)}>
                        Buy for {theme.priceBdt ? formatBdt(Number(theme.priceBdt)) : 'a one-time price'}
                      </Button>
                    ) : null}
                    <Link href="/dashboard/billing" className="text-xs font-medium text-[var(--color-accent)] hover:underline">
                      or get it with the Business plan
                    </Link>
                  </div>
                ) : !selected && !disabled && !isLockedTheme(theme) ? (
                  <Button
                    className="mt-3"
                    variant="secondary"
                    disabled={busyThemeId === theme.id}
                    onClick={() => onSelect(theme.id)}
                  >
                    {busyThemeId === theme.id ? 'Selecting…' : `Edit ${theme.name}`}
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
