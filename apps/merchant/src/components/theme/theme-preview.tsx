'use client';

import type { CSSProperties } from 'react';
import type { StoreThemeConfig } from '@ecomesta/types';
import { themeCssVariables, validColor } from '@/components/theme/theme-utils';

/**
 * Simplified in-app mock of the storefront chrome. It renders from the draft
 * configuration with the same CSS variables the storefront uses, so no
 * unauthenticated preview surface has to exist.
 */
export function ThemePreview({
  config,
  storeName,
}: {
  config: StoreThemeConfig;
  storeName: string;
}) {
  const branding = config.branding ?? {};
  const announcement = config.announcement ?? {};
  const header = config.header ?? {};
  const hero = config.hero ?? {};
  const footer = config.footer ?? {};
  const sections = config.homepage?.sections ?? [];

  const brandName = branding.brandName?.trim() || storeName;
  const menuItems = header.menuItems ?? [];
  const layout = header.layout ?? 'classic';
  const alignment = hero.alignment ?? 'left';
  const alignmentClass =
    alignment === 'center'
      ? 'items-center text-center'
      : alignment === 'right'
        ? 'items-end text-right'
        : 'items-start text-left';

  return (
    <div
      aria-label="Storefront preview"
      role="region"
      className="overflow-hidden rounded-lg border border-[var(--color-border)]"
      style={
        {
          ...themeCssVariables(config),
          background: 'var(--theme-bg)',
          color: 'var(--theme-text)',
          fontFamily: 'var(--theme-body-font)',
        } as CSSProperties
      }
    >
      {announcement.enabled ? (
        <div
          className="px-3 py-2 text-center text-xs"
          style={{
            background: validColor(announcement.backgroundColor, 'var(--theme-secondary)'),
            color: validColor(announcement.textColor, '#ffffff'),
          }}
        >
          {announcement.text?.trim() || 'Announcement text'}
        </div>
      ) : null}

      <div
        className={`flex gap-3 border-b px-4 py-3 ${
          layout === 'centered'
            ? 'flex-col items-center'
            : 'items-center justify-between'
        }`}
        style={{
          background: 'var(--theme-surface)',
          borderColor: 'var(--theme-muted)',
        }}
      >
        <div className="flex min-w-0 items-center gap-2">
          {branding.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={branding.logoUrl}
              alt=""
              className="h-7 w-7 object-cover"
              style={{ borderRadius: 'var(--theme-radius)' }}
            />
          ) : (
            <span
              className="flex h-7 w-7 items-center justify-center text-xs font-semibold text-white"
              style={{
                background: 'var(--theme-primary)',
                borderRadius: 'var(--theme-radius)',
              }}
              aria-hidden
            >
              {brandName.slice(0, 1).toUpperCase()}
            </span>
          )}
          <span
            className="truncate text-sm font-semibold"
            style={{
              fontFamily: 'var(--theme-heading-font)',
              letterSpacing: 'var(--theme-heading-tracking, normal)',
            }}
          >
            {brandName}
          </span>
        </div>

        {layout !== 'minimal' && menuItems.length > 0 ? (
          <nav className="flex flex-wrap gap-3 text-xs" aria-label="Preview navigation">
            {menuItems.map((item) => (
              <span key={`${item.label}-${item.href}`} style={{ color: 'var(--theme-muted)' }}>
                {item.label}
              </span>
            ))}
          </nav>
        ) : null}

        <div className="flex items-center gap-2 text-[10px]" style={{ color: 'var(--theme-muted)' }}>
          {header.showSearch ? <span>Search</span> : null}
          {header.showCart !== false ? <span>Cart (0)</span> : null}
        </div>
      </div>

      {hero.enabled ? (
        <div
          className="relative px-5 py-10"
          style={{
            background: hero.imageUrl
              ? `url(${JSON.stringify(hero.imageUrl)}) center/cover no-repeat`
              : 'var(--theme-surface)',
          }}
        >
          {hero.imageUrl ? (
            <div
              className="absolute inset-0"
              style={{
                background: '#000000',
                opacity: hero.overlayOpacity ?? 0.35,
              }}
            />
          ) : null}
          <div className={`relative flex flex-col gap-2 ${alignmentClass}`}>
            <p
              className="text-xl font-semibold"
              style={{
                fontFamily: 'var(--theme-heading-font)',
                letterSpacing: 'var(--theme-heading-tracking, normal)',
                color: hero.imageUrl ? '#ffffff' : 'var(--theme-text)',
              }}
            >
              {hero.headline?.trim() || 'Hero headline'}
            </p>
            {hero.subheadline ? (
              <p
                className="max-w-sm text-xs"
                style={{ color: hero.imageUrl ? '#f8fafc' : 'var(--theme-muted)' }}
              >
                {hero.subheadline}
              </p>
            ) : null}
            {hero.ctaLabel ? (
              <span
                className="mt-1 inline-flex px-3 py-1.5 text-xs font-medium text-white"
                style={{
                  background: 'var(--theme-primary)',
                  borderRadius: 'var(--theme-radius)',
                }}
              >
                {hero.ctaLabel}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="space-y-3 px-5 py-5">
        {sections
          .filter((section) => section.enabled !== false)
          .map((section) => (
            <div key={section.type} className="space-y-2">
              <p
                className="text-sm font-semibold"
                style={{ fontFamily: 'var(--theme-heading-font)' }}
              >
                {section.title?.trim() || section.type.replace(/_/g, ' ')}
              </p>
              <div className="grid grid-cols-3 gap-2">
                {[0, 1, 2].map((index) => (
                  <div
                    key={index}
                    className="h-12 border"
                    style={{
                      background: 'var(--theme-surface)',
                      borderColor: 'var(--theme-muted)',
                      borderRadius: 'var(--theme-radius)',
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
      </div>

      <div
        className="space-y-1 border-t px-5 py-4 text-[11px]"
        style={{
          background: 'var(--theme-surface)',
          borderColor: 'var(--theme-muted)',
          color: 'var(--theme-muted)',
        }}
      >
        {footer.tagline ? <p>{footer.tagline}</p> : null}
        <p>
          {footer.copyright?.trim() ||
            `© ${new Date().getFullYear()} ${brandName}`}
        </p>
        {(footer.menuItems ?? []).length > 0 ? (
          <p>{(footer.menuItems ?? []).map((item) => item.label).join(' · ')}</p>
        ) : null}
        {(footer.socialLinks ?? []).length > 0 ? (
          <p>{(footer.socialLinks ?? []).map((link) => link.network).join(' · ')}</p>
        ) : null}
        {footer.showPaymentIcons ? <p>Payment methods</p> : null}
      </div>
    </div>
  );
}
