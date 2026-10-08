import Link from 'next/link';
import type { StoreThemeConfig, ThemeHomepageSection } from '@ecomesta/types';
import { withStoreParam } from '@/lib/theme';

export const CONTENT_SECTION_TYPES = ['rich_text', 'image_banner'] as const;
/** Sections that appear at most once. */
const FEATURED_TYPES = ['featured_categories', 'featured_products', 'deal_of_day'] as const;
const RENDERED = new Set<string>([...FEATURED_TYPES, ...CONTENT_SECTION_TYPES]);

/** Preview-frame address of a section, so the editor can open its settings. */
export function sectionAnchor(section: ThemeHomepageSection, index: number): string {
  return CONTENT_SECTION_TYPES.includes(section.type as (typeof CONTENT_SECTION_TYPES)[number])
    ? `section:${section.id ?? index}`
    : section.type;
}

/**
 * The homepage blocks in the merchant's order. No list at all means the
 * default blocks; product and category rows appear at most once.
 */
export function homeSections(config: StoreThemeConfig): ThemeHomepageSection[] {
  const listed = config.homepage?.sections ?? [];
  if (listed.length === 0) {
    return [
      { type: 'featured_categories', enabled: true },
      { type: 'featured_products', enabled: true },
    ];
  }
  const seen = new Set<string>();
  return listed.filter((section) => {
    if (!RENDERED.has(section.type)) return false;
    if ((FEATURED_TYPES as readonly string[]).includes(section.type)) {
      if (seen.has(section.type)) return false;
      seen.add(section.type);
    }
    return true;
  });
}

function SectionButton({ section, storeSlug, inverted }: { section: ThemeHomepageSection; storeSlug: string; inverted?: boolean }) {
  if (!section.buttonLabel || !section.buttonHref) return null;
  return (
    <Link
      href={withStoreParam(section.buttonHref, storeSlug)}
      className={`inline-flex items-center rounded-[var(--theme-radius,0.5rem)] px-6 py-3 text-sm font-semibold ${
        inverted
          ? 'bg-white text-[var(--color-ink)] hover:bg-white/90'
          : 'bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)]'
      }`}
    >
      {section.buttonLabel}
    </Link>
  );
}

/** Heading, a few lines of text and an optional button. Text is plain: line breaks are kept. */
export function RichTextSection({ section, anchor, storeSlug }: { section: ThemeHomepageSection; anchor: string; storeSlug: string }) {
  if (!section.title && !section.text && !section.buttonLabel) return null;
  return (
    <section
      data-theme-section={anchor}
      data-theme-section-label="Rich text"
      className="mx-auto max-w-3xl space-y-4 px-2 py-4 text-center"
    >
      {section.title ? (
        <h2 className="text-2xl font-bold tracking-tight text-[var(--color-ink)] sm:text-3xl">{section.title}</h2>
      ) : null}
      {section.text ? (
        <p className="whitespace-pre-line text-base leading-relaxed text-[var(--color-muted)]">{section.text}</p>
      ) : null}
      <SectionButton section={section} storeSlug={storeSlug} />
    </section>
  );
}

/** A wide image with a heading, text and button over it. */
export function ImageBannerSection({ section, anchor, storeSlug }: { section: ThemeHomepageSection; anchor: string; storeSlug: string }) {
  return (
    <section
      data-theme-section={anchor}
      data-theme-section-label="Image banner"
      className="relative flex min-h-[260px] items-center overflow-hidden px-6 py-12 text-white sm:min-h-[340px] sm:px-12"
      style={{ borderRadius: 'var(--theme-radius, 1rem)', backgroundColor: 'var(--theme-secondary, #1e293b)' }}
    >
      {section.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={section.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : null}
      {section.imageUrl ? <div className="absolute inset-0 bg-black/40" aria-hidden="true" /> : null}
      <div className="relative max-w-xl space-y-4">
        {section.title ? <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{section.title}</h2> : null}
        {section.text ? <p className="whitespace-pre-line text-lg text-white/85">{section.text}</p> : null}
        <SectionButton section={section} storeSlug={storeSlug} inverted />
      </div>
    </section>
  );
}

/** A rich text or image banner section, or nothing for other types. */
export function ContentSection({ section, index, storeSlug }: { section: ThemeHomepageSection; index: number; storeSlug: string }) {
  if (section.enabled === false) return null;
  const anchor = sectionAnchor(section, index);
  if (section.type === 'rich_text') return <RichTextSection section={section} anchor={anchor} storeSlug={storeSlug} />;
  if (section.type === 'image_banner') return <ImageBannerSection section={section} anchor={anchor} storeSlug={storeSlug} />;
  return null;
}
