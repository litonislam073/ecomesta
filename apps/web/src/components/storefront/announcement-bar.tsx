import Link from 'next/link';
import type { StoreThemeConfig } from '@ecomesta/types';
import { withStoreParam } from '@/lib/theme';

export function AnnouncementBar({
  config,
  storeSlug,
}: {
  config: StoreThemeConfig;
  storeSlug: string;
}) {
  const announcement = config.announcement;
  const text = announcement?.text?.trim();
  if (!announcement?.enabled || !text) {
    return null;
  }

  const style = {
    backgroundColor: announcement.backgroundColor ?? 'var(--theme-secondary, #0f172a)',
    color: announcement.textColor ?? '#ffffff',
  };

  return (
    <div role="region" aria-label="Announcement" style={style}>
      <div className="mx-auto max-w-6xl px-4 py-2 text-center text-sm">
        {announcement.href ? (
          <Link
            className="underline-offset-2 hover:underline"
            href={withStoreParam(announcement.href, storeSlug)}
          >
            {text}
          </Link>
        ) : (
          text
        )}
      </div>
    </div>
  );
}
