import Link from 'next/link';
import { Fragment } from 'react';
import type { PublicCategory, PublicProductCard, PublicStore, StoreThemeConfig, ThemeHomepageSection } from '@ecomesta/types';
import { ContentSection, homeSections, sectionAnchor } from '@/components/storefront/content-sections';
import { withStoreParam } from '@/lib/theme';
import { KIcon, type KenakataIconName } from './icons';
import { KenakataProductCard } from './kenakata-product-card';
import { KK, kenakataDiscount } from './kenakata-utils';

/** Soft tile colours from the design, used where a category has no picture. */
const TILE_COLOURS = ['#e6efe9', '#f3e9dc', '#e4e9f2', '#f1e4e4', '#ede9f5', '#e9efd9'];

const TRUST: { icon: KenakataIconName; title: string; text: string; tint: string }[] = [
  { icon: 'cash', title: 'Cash on delivery', text: 'Pay when your order arrives', tint: 'color-mix(in srgb, var(--color-accent) 14%, white)' },
  { icon: 'phone', title: 'bKash and Nagad', text: 'Mobile payments supported', tint: '#f3e9dc' },
  { icon: 'returns', title: 'Easy returns', text: 'On eligible items', tint: '#e4e9f2' },
  { icon: 'shield', title: 'Genuine products', text: 'Checked before dispatch', tint: '#f1e4e4' },
];

function SectionHeading({ id, title, link }: { id: string; title: string; link?: { href: string; label: string } }) {
  return (
    <div className="mb-6 flex items-baseline justify-between gap-4">
      <h2 id={id} className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight text-[var(--color-ink)]">
        {title}
      </h2>
      {link ? (
        <Link href={link.href} className="shrink-0 font-semibold text-[var(--color-ink)] hover:underline">
          {link.label} →
        </Link>
      ) : null}
    </div>
  );
}

function CategoryImage({
  category,
  index,
  className,
  fallbackUrl,
}: {
  category: PublicCategory;
  index: number;
  className: string;
  /** A photo of one of the category's products, used until the merchant adds a category image. */
  fallbackUrl?: string | null;
}) {
  const src = category.imageUrl || fallbackUrl;
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" loading="lazy" className={className} />
  ) : (
    <div
      className={`${className} flex items-center justify-center font-[family-name:var(--font-display)] text-5xl font-bold text-[var(--color-ink)]/70`}
      style={{ backgroundColor: TILE_COLOURS[index % TILE_COLOURS.length] }}
    >
      {category.name.slice(0, 1).toUpperCase()}
    </div>
  );
}

export function KenakataHome({
  store,
  storeSlug,
  config,
  products,
  categories,
  showCategories,
  showProducts,
  categoriesTitle,
  productsTitle,
  sections,
  dealProduct = null,
}: {
  store: PublicStore;
  storeSlug: string;
  config: StoreThemeConfig;
  products: PublicProductCard[];
  categories: PublicCategory[];
  showCategories: boolean;
  showProducts: boolean;
  categoriesTitle?: string;
  productsTitle?: string;
  sections?: ThemeHomepageSection[];
  dealProduct?: PublicProductCard | null;
}) {
  const hero = config.hero ?? {};
  const branding = config.branding ?? {};
  const href = (path: string) => withStoreParam(path, storeSlug);
  const allProducts = href('/products');
  // A category without its own picture shows one of its products until the merchant adds one.
  const productPhoto = (categoryId: string) =>
    products.find((p) => p.images.length > 0 && p.categories.some((c) => c.id === categoryId))?.images[0]?.url ?? null;
  // Cards beside the hero: the merchant's (with pictures) from the editor, else the first two categories.
  const sideCards: { key: string; label: string; title: string; imageUrl: string | null; href: string }[] = hero.cards
    ? hero.cards.map((card, index) => ({
        key: `card-${index}`,
        label: card.label?.trim() ?? '',
        title: card.title?.trim() ?? '',
        imageUrl: card.imageUrl ?? null,
        href: href(card.href || '/products'),
      }))
    : categories.slice(0, 2).map((category) => ({
        key: category.id,
        label: 'Shop by category',
        title: category.name,
        imageUrl: category.imageUrl || productPhoto(category.id),
        href: href(`/categories/${category.slug}`),
      }));

  const heroBlock =
    hero.enabled !== false ? (
      <section
        data-theme-section="hero"
        aria-labelledby="kk-hero"
        className="mx-auto flex max-w-7xl flex-wrap gap-6 px-4 pt-6 sm:px-8 sm:pt-8"
      >
        <div className="relative flex min-h-[380px] min-w-0 flex-[999_1_560px] items-center overflow-hidden rounded-3xl bg-[var(--color-accent)] text-white lg:min-h-[420px]">
          {hero.imageUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={hero.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
              <div className="absolute inset-0 bg-black/45" aria-hidden="true" />
            </>
          ) : (
            <>
              <div aria-hidden="true" className="absolute -right-24 -top-24 h-[420px] w-[420px] rounded-full bg-white/10" />
              <div aria-hidden="true" className="absolute -bottom-32 right-16 hidden h-[300px] w-[300px] rounded-full md:block" style={{ backgroundColor: KK.sun }} />
            </>
          )}
          <div className="relative flex max-w-xl flex-col gap-5 p-8 sm:p-12 lg:p-14">
            {branding.tagline?.trim() ? (
              <p className="text-xs font-semibold uppercase tracking-[0.14em] sm:text-sm">{branding.tagline.trim()}</p>
            ) : null}
            <h1 id="kk-hero" className="font-[family-name:var(--font-display)] text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
              {hero.headline?.trim() || branding.brandName?.trim() || store.name}
            </h1>
            {hero.subheadline?.trim() || store.description ? (
              <p className="text-lg text-white/85">{hero.subheadline?.trim() || store.description}</p>
            ) : null}
            <div className="flex flex-wrap gap-3 pt-2">
              <Link
                href={href(hero.ctaHref || '/products')}
                className="inline-flex h-14 items-center rounded-full px-8 font-semibold text-[var(--color-ink)] hover:brightness-95"
                style={{ backgroundColor: KK.sun }}
              >
                {hero.ctaLabel?.trim() || 'Shop now'}
              </Link>
              <Link
                href={allProducts}
                className="inline-flex h-14 items-center rounded-full border-[1.5px] border-white px-8 font-semibold text-white hover:bg-white/10"
              >
                Browse all products
              </Link>
            </div>
          </div>
        </div>
        {sideCards.length > 0 ? (
          <div className="flex min-w-0 flex-1 basis-[320px] flex-col gap-6">
            {sideCards.map((card, index) => (
              <Link
                key={card.key}
                href={card.href}
                data-theme-section="hero"
                className="relative flex min-h-[180px] flex-1 flex-col justify-between overflow-hidden rounded-3xl p-7 hover:brightness-[0.98]"
                style={{ backgroundColor: TILE_COLOURS[(index + 1) % TILE_COLOURS.length] }}
              >
                {card.imageUrl ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={card.imageUrl} alt="" className="absolute inset-y-0 right-0 h-full w-[45%] object-cover" />
                  </>
                ) : null}
                <span className="relative text-sm font-medium text-[var(--color-muted)]">{card.label}</span>
                <span className={`relative ${card.imageUrl ? 'max-w-[52%]' : ''}`}>
                  <span className="block font-[family-name:var(--font-display)] text-2xl font-bold leading-tight text-[var(--color-ink)] sm:text-3xl">
                    {card.title}
                  </span>
                  <span className="block pt-2 font-semibold text-[var(--color-ink)]">Shop now →</span>
                </span>
              </Link>
            ))}
          </div>
        ) : null}
      </section>
    ) : null;

  const trustBlock = (
    <section aria-label="Why shop with us" className="mx-auto grid max-w-7xl gap-4 px-4 pt-10 sm:grid-cols-2 sm:px-8 lg:grid-cols-4">
      {TRUST.map((item) => (
        <div key={item.title} className="flex items-center gap-4 rounded-2xl border border-[var(--color-border)] px-5 py-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[var(--color-ink)]" style={{ backgroundColor: item.tint }}>
            <KIcon name={item.icon} />
          </span>
          <span>
            <span className="block font-semibold text-[var(--color-ink)]">{item.title}</span>
            <span className="block text-sm text-[var(--color-muted)]">{item.text}</span>
          </span>
        </div>
      ))}
    </section>
  );

  const categoriesBlock =
    showCategories && categories.length > 0 ? (
      <section data-theme-section="featured_categories" aria-labelledby="kk-categories" className="mx-auto max-w-7xl px-4 pt-14 sm:px-8 sm:pt-16">
        <SectionHeading id="kk-categories" title={categoriesTitle ?? 'Shop by category'} link={{ href: allProducts, label: 'View all' }} />
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {categories.slice(0, 12).map((category, index) => (
            <li key={category.id}>
              <Link href={href(`/categories/${category.slug}`)} className="group block">
                <div className="overflow-hidden rounded-2xl">
                  <CategoryImage
                    category={category}
                    index={index}
                    fallbackUrl={productPhoto(category.id)}
                    className="aspect-square w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                </div>
                <p className="pt-3 text-lg font-semibold leading-tight text-[var(--color-ink)]">{category.name}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    ) : null;

  const renderDeals = (settings: ThemeHomepageSection | null) => {
    if (settings?.enabled === false) return null;
    const chosen = settings?.productId
      ? (products.find((p) => p.id === settings.productId) ?? (dealProduct?.id === settings.productId ? dealProduct : null))
      : null;
    const onSale = products.filter((p) => p.available && kenakataDiscount(p) !== null && p.id !== chosen?.id);
    const deals = [...(chosen ? [chosen] : []), ...onSale].slice(0, 4);
    if (deals.length === 0) return null;
    return (
      <section data-theme-section="deal_of_day" data-theme-section-label="Deals of the day" aria-labelledby="kk-deals" className="mx-auto max-w-7xl px-4 pt-14 sm:px-8 sm:pt-16">
        <SectionHeading
          id="kk-deals"
          title={settings?.title?.trim() || 'Deals of the day'}
          link={{ href: allProducts, label: settings?.buttonLabel?.trim() || 'See all deals' }}
        />
        {settings?.text?.trim() ? <p className="-mt-3 mb-6 whitespace-pre-line text-[var(--color-muted)]">{settings.text.trim()}</p> : null}
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6 md:grid-cols-3 lg:grid-cols-4">
          {deals.map((product) => (
            <KenakataProductCard key={product.id} product={product} storeSlug={storeSlug} />
          ))}
        </div>
      </section>
    );
  };

  /** Image banners (editor sections) in the design's style; neighbours share a row. */
  const renderBanners = (banners: { section: ThemeHomepageSection; index: number }[]) => (
    <section aria-label="Offers" className="mx-auto grid max-w-7xl gap-6 px-4 pt-14 sm:px-8 sm:pt-16 md:grid-cols-2">
      {banners.map(({ section, index }, position) => {
        const dark = position % 2 === 0;
        const buttonHref = href(section.buttonHref || '/products');
        return (
          <div
            key={section.id ?? index}
            data-theme-section={sectionAnchor(section, index)}
            data-theme-section-label="Image banner"
            className={`relative flex min-h-[260px] flex-col justify-end gap-3 overflow-hidden rounded-3xl p-8 sm:p-10 ${
              banners.length === 1 ? 'md:col-span-2' : ''
            } ${dark || section.imageUrl ? 'text-white' : 'text-[var(--color-ink)]'}`}
            style={{ backgroundColor: dark ? KK.ink : '#f1e4e4' }}
          >
            {section.imageUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={section.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
                <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
              </>
            ) : null}
            {section.text?.trim() ? (
              <span className="relative text-sm font-semibold uppercase tracking-widest opacity-80">{section.text.trim()}</span>
            ) : null}
            {section.title?.trim() ? (
              <h2 className="relative font-[family-name:var(--font-display)] text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
                {section.title.trim()}
              </h2>
            ) : null}
            {section.buttonLabel?.trim() ? (
              <Link
                href={buttonHref}
                className="relative inline-flex h-11 w-fit items-center rounded-full bg-white px-6 font-semibold text-[var(--color-ink)] hover:bg-slate-100"
              >
                {section.buttonLabel.trim()}
              </Link>
            ) : null}
          </div>
        );
      })}
    </section>
  );

  const productsBlock = showProducts ? (
    <section data-theme-section="featured_products" aria-labelledby="kk-new" className="mx-auto max-w-7xl px-4 pt-14 sm:px-8 sm:pt-16">
      <SectionHeading id="kk-new" title={productsTitle ?? 'New arrivals'} link={{ href: allProducts, label: 'View all' }} />
      {products.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[var(--color-border)] px-6 py-12 text-center text-[var(--color-muted)]">
          No products published yet.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6 md:grid-cols-3 lg:grid-cols-4">
          {products.slice(0, 8).map((product) => (
            <KenakataProductCard key={product.id} product={product} storeSlug={storeSlug} badge="New" />
          ))}
        </div>
      )}
    </section>
  ) : null;

  const homeList = sections ?? homeSections(config);
  const dealListed = homeList.some((section) => section.type === 'deal_of_day');
  // Neighbouring image banners share a row, as in the design.
  const groups: ({ kind: 'banners'; items: { section: ThemeHomepageSection; index: number }[] } | { kind: 'one'; section: ThemeHomepageSection; index: number })[] = [];
  homeList.forEach((section, index) => {
    if (section.type === 'image_banner') {
      if (section.enabled === false) return;
      const last = groups[groups.length - 1];
      if (last?.kind === 'banners' && last.items.length < 2) last.items.push({ section, index });
      else groups.push({ kind: 'banners', items: [{ section, index }] });
      return;
    }
    groups.push({ kind: 'one', section, index });
  });

  return (
    // Full-width page: the layout's padded <main> is undone for this theme.
    <div className="-mx-4 -my-6 sm:-mx-8">
      {heroBlock}
      {trustBlock}
      {groups.map((group) =>
        group.kind === 'banners' ? (
          <Fragment key={`banners-${group.items[0]!.index}`}>{renderBanners(group.items)}</Fragment>
        ) : (
          <Fragment key={group.section.id ?? `${group.section.type}-${group.index}`}>
            {group.section.type === 'featured_categories' ? (
              categoriesBlock
            ) : group.section.type === 'deal_of_day' ? (
              renderDeals(group.section)
            ) : group.section.type === 'featured_products' ? (
              <>
                {dealListed ? null : renderDeals(null)}
                {productsBlock}
              </>
            ) : (
              <div className="mx-auto max-w-7xl px-4 pt-14 sm:px-8 sm:pt-16">
                <ContentSection section={group.section} index={group.index} storeSlug={storeSlug} />
              </div>
            )}
          </Fragment>
        ),
      )}
    </div>
  );
}
