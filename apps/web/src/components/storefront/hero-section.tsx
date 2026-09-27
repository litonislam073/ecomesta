import Link from 'next/link';
import type { StoreThemeConfig } from '@ecomesta/types';
import { withStoreParam } from '@/lib/theme';

export function HeroSection({
  config,
  storeSlug,
  fallbackHeadline,
  fallbackSubheadline,
}: {
  config: StoreThemeConfig;
  storeSlug: string;
  fallbackHeadline: string;
  fallbackSubheadline?: string | null;
}) {
  const hero = config.hero ?? {};
  if (hero.enabled === false) {
    return null;
  }

  const headline = hero.headline?.trim() || fallbackHeadline;
  const subheadline =
    hero.subheadline?.trim() ||
    fallbackSubheadline ||
    'Browse products and add them to your cart.';
  const ctaLabel = hero.ctaLabel?.trim() || 'Shop products';
  const ctaHref = hero.ctaHref?.trim() || '/products';
  const alignment = hero.alignment ?? 'left';
  const onImage = Boolean(hero.imageUrl);

  const alignmentClass =
    alignment === 'center'
      ? 'items-center text-center mx-auto'
      : alignment === 'right'
        ? 'items-end text-right ml-auto'
        : 'items-start text-left';

  return (
    <section
      className="relative overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-14 md:px-10"
      style={{ borderRadius: 'var(--theme-radius, 1rem)' }}
    >
      {hero.imageUrl ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={hero.imageUrl}
            alt=""
            aria-hidden
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div
            className="absolute inset-0 bg-black"
            style={{ opacity: hero.overlayOpacity ?? 0.35 }}
          />
        </>
      ) : (
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background:
              'radial-gradient(circle at 20% 20%, rgba(15,107,92,0.18), transparent 45%), linear-gradient(135deg, #f7fbf9, #eef4f1)',
          }}
        />
      )}

      <div className={`relative flex max-w-2xl flex-col ${alignmentClass}`}>
        <h1
          className="font-[family-name:var(--font-display)] text-4xl tracking-tight md:text-5xl"
          style={{
            color: onImage ? '#ffffff' : undefined,
            letterSpacing: 'var(--theme-heading-tracking, normal)',
          }}
        >
          {headline}
        </h1>
        <p
          className="mt-4 max-w-xl text-lg text-[var(--color-muted)]"
          style={{ color: onImage ? '#f1f5f9' : undefined }}
        >
          {subheadline}
        </p>
        <Link
          href={withStoreParam(ctaHref, storeSlug)}
          className="mt-8 inline-flex bg-[var(--color-accent)] px-5 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-accent-hover)]"
          style={{ borderRadius: 'var(--theme-radius, 0.375rem)' }}
        >
          {ctaLabel}
        </Link>
      </div>
    </section>
  );
}
