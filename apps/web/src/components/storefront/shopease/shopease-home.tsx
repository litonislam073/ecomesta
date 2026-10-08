import Link from 'next/link';
import { Fragment } from 'react';
import type { PublicCategory, PublicProductCard, PublicStore, StoreThemeConfig, ThemeHomepageSection } from '@ecomesta/types';
import { ContentSection, homeSections } from '@/components/storefront/content-sections';
import { productCardPrice } from '@/components/product-card';
import { formatMoney } from '@/lib/money';
import { withStoreParam } from '@/lib/theme';
import { Icon, type IconName } from './icons';
import { AddToCartIcon, DealCountdown } from './shopease-interactive';

const DARK = 'var(--theme-secondary, #0f2b20)';

/** Percent off for a simple product on sale; null when it is not discounted. */
export function discountPercent(product: PublicProductCard): number | null {
  if (product.hasVariants || !product.compareAtPrice) return null;
  const price = Number(product.price);
  const was = Number(product.compareAtPrice);
  if (!(was > price && price >= 0)) return null;
  return Math.round(((was - price) / was) * 100);
}

/** The store's best current discount (an available simple product), for the deal of the day. */
export function pickDeal(products: PublicProductCard[]): PublicProductCard | null {
  let best: PublicProductCard | null = null;
  let bestOff = 0;
  for (const product of products) {
    const off = discountPercent(product);
    if (product.available && off !== null && off > bestOff) {
      best = product;
      bestOff = off;
    }
  }
  return best;
}

/** "Shop More, Save More!" → ["Shop More,", "Save More!"]: the second part is highlighted. */
export function splitHeadline(headline: string): [string, string | null] {
  const index = headline.indexOf(',');
  if (index < 0 || index === headline.length - 1) return [headline, null];
  return [headline.slice(0, index + 1).trim(), headline.slice(index + 1).trim()];
}

const HERO_POINTS: { icon: IconName; title: string; text: string }[] = [
  { icon: 'tag', title: 'Best prices', text: 'Great value' },
  { icon: 'shield', title: 'Secure', text: 'Checkout' },
  { icon: 'truck', title: 'Fast delivery', text: 'To your door' },
];

const TRUST: { icon: IconName; title: string; text: string }[] = [
  { icon: 'truck', title: 'Fast delivery', text: 'Right to your doorstep' },
  { icon: 'lock', title: 'Secure checkout', text: 'Your details stay safe' },
  { icon: 'star', title: 'Quality products', text: 'Chosen with care' },
  { icon: 'headset', title: 'Friendly support', text: "We're here to help" },
];

function ProductImage({ product, className }: { product: PublicProductCard; className: string }) {
  const image = product.images[0];
  return image ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={image.url} alt={image.alt || product.name} className={className} />
  ) : (
    <div className={`${className} flex items-center justify-center text-[var(--color-muted)]`}>
      <Icon name="box" className="h-10 w-10" />
    </div>
  );
}

export function ShopEaseHome({
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
  /** Homepage blocks in the merchant's order. */
  sections?: ThemeHomepageSection[];
  /** The deal's chosen product when it is not among `products`. */
  dealProduct?: PublicProductCard | null;
}) {
  const hero = config.hero ?? {};
  const branding = config.branding ?? {};
  const productHref = (product: PublicProductCard) => withStoreParam(`/products/${product.slug}`, storeSlug);
  const [headTop, headAccent] = splitHeadline(hero.headline?.trim() || branding.brandName?.trim() || store.name);
  const heroImageProduct = products.find((p) => p.images.length > 0) ?? null;
  const bestOff = Math.max(0, ...products.map((p) => (p.available ? discountPercent(p) ?? 0 : 0)));
  // Offer badge: the best current discount (automatic), the merchant's own text, or none.
  const badgeMode = hero.badgeMode ?? 'auto';
  const badge =
    badgeMode === 'custom'
      ? hero.badgeTop?.trim() || hero.badgeMain?.trim() || hero.badgeBottom?.trim()
        ? { top: hero.badgeTop?.trim(), main: hero.badgeMain?.trim(), bottom: hero.badgeBottom?.trim() }
        : null
      : badgeMode === 'auto' && bestOff >= 5
        ? { top: 'UP TO', main: `${bestOff}%`, bottom: 'OFF' }
        : null;
  const arrivals = products.slice(0, 8);

  const categoriesBlock = (
    showCategories && categories.length > 0 ? (
        <section data-theme-section="featured_categories" aria-labelledby="shopease-categories" className="space-y-6">
          <h2 id="shopease-categories" className="text-center text-2xl font-extrabold tracking-tight text-[var(--color-ink)] sm:text-3xl">
            {categoriesTitle ?? 'Shop by category'}
          </h2>
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {categories.slice(0, 10).map((category) => (
              <li key={category.id}>
                <Link
                  href={withStoreParam(`/categories/${category.slug}`, storeSlug)}
                  className="group block overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white shadow-sm transition-shadow hover:shadow-lg"
                >
                  <div className="aspect-[4/3] overflow-hidden bg-[var(--color-surface)]">
                    {category.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={category.imageUrl} alt="" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-4xl font-extrabold text-[var(--color-accent)]">
                        {category.name.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="px-3 py-3 text-center">
                    <p className="truncate font-bold text-[var(--color-ink)]">{category.name}</p>
                    <p className="mt-0.5 inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-muted)] group-hover:text-[var(--color-accent)]">
                      Shop now <Icon name="arrow" className="h-3 w-3" />
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null
  );
  /** Deal of the day, from its section settings (defaults when the theme has none yet). */
  const renderDeal = (settings: ThemeHomepageSection | null) => {
    if (settings?.enabled === false) return null;
    const chosen = settings?.productId
      ? (products.find((p) => p.id === settings.productId) ?? (dealProduct?.id === settings.productId ? dealProduct : null))
      : null;
    const deal = chosen ?? pickDeal(products);
    if (!deal) return null;
    const off = discountPercent(deal);
    const title = settings ? settings.title?.trim() : "Grab it before it's gone!";
    const text = settings ? settings.text?.trim() : 'Today only — the offer ends at midnight.';
    const button = (settings ? settings.buttonLabel?.trim() : 'Shop the deal') || 'Shop the deal';
    const countdown = settings?.showCountdown ?? true;
    return (
      <section
        data-theme-section="deal_of_day"
        data-theme-section-label="Deal of the day"
        aria-label="Deal of the day"
        className="grid items-center gap-6 rounded-3xl bg-[#fdeee4] p-6 sm:p-8 lg:grid-cols-[1fr_1.2fr]"
      >
        <div className="space-y-4">
          <p className="text-sm font-bold uppercase tracking-wider text-[var(--color-accent)]">Deal of the day</p>
          {title ? (
            <h2 className="text-3xl font-extrabold leading-tight tracking-tight text-[var(--color-ink)] sm:text-4xl">{title}</h2>
          ) : null}
          {text ? <p className="whitespace-pre-line text-[var(--color-muted)]">{text}</p> : null}
          <Link
            href={productHref(deal)}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-accent)] px-6 py-3 text-sm font-bold uppercase tracking-wide text-white hover:bg-[var(--color-accent-hover)]"
          >
            {button} <Icon name="arrow" className="h-4 w-4" />
          </Link>
        </div>
        <div className="flex flex-col gap-5 rounded-2xl bg-white p-5 shadow-sm sm:flex-row sm:items-center">
          <Link href={productHref(deal)} className="block shrink-0 sm:w-44">
            <ProductImage product={deal} className="aspect-square w-full rounded-xl object-cover" />
          </Link>
          <div className="min-w-0 flex-1 space-y-3">
            <h3 className="text-lg font-bold text-[var(--color-ink)]">
              <Link href={productHref(deal)} className="hover:text-[var(--color-accent)]">
                {deal.name}
              </Link>
            </h3>
            {deal.shortDescription ? <p className="line-clamp-2 text-sm text-[var(--color-muted)]">{deal.shortDescription}</p> : null}
            <p className="flex flex-wrap items-baseline gap-x-3">
              <span className="text-2xl font-extrabold text-[var(--color-accent)]">
                {productCardPrice(deal) ?? formatMoney(deal.price, deal.currency)}
              </span>
              {off ? (
                <>
                  <span className="text-[var(--color-muted)] line-through">{formatMoney(deal.compareAtPrice!, deal.currency)}</span>
                  <span className="rounded-full bg-[#fdeee4] px-2 py-0.5 text-xs font-bold text-[var(--color-accent)]">{off}% off</span>
                </>
              ) : null}
            </p>
            {countdown ? <DealCountdown /> : null}
          </div>
        </div>
      </section>
    );
  };
  const homeList = sections ?? homeSections(config);
  // Themes saved before the deal became a section keep it above the products.
  const dealListed = homeList.some((section) => section.type === 'deal_of_day');

  const productsBlock = (
    showProducts ? (
        <section data-theme-section="featured_products" aria-labelledby="shopease-arrivals" className="space-y-6">
          <div className="flex items-end justify-between gap-4">
            <h2 id="shopease-arrivals" className="text-2xl font-extrabold tracking-tight text-[var(--color-ink)] sm:text-3xl">
              {productsTitle ?? 'New arrivals'}
            </h2>
            <Link href={withStoreParam('/products', storeSlug)} className="inline-flex items-center gap-1 text-sm font-bold text-[var(--color-accent)] hover:underline">
              View all <Icon name="arrow" className="h-4 w-4" />
            </Link>
          </div>
          {arrivals.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-[var(--color-border)] px-6 py-12 text-center text-[var(--color-muted)]">
              No products published yet.
            </p>
          ) : (
            <ul className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {arrivals.map((product) => {
                const price = productCardPrice(product);
                const off = discountPercent(product);
                return (
                  <li key={product.id} className="group flex flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white shadow-sm transition-shadow hover:shadow-lg">
                    <Link href={productHref(product)} className="relative block aspect-square overflow-hidden bg-[var(--color-surface)]">
                      <ProductImage product={product} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                      <span className="absolute left-3 top-3 rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white" style={{ backgroundColor: off ? 'var(--color-accent)' : DARK }}>
                        {off ? `-${off}%` : 'New'}
                      </span>
                    </Link>
                    <div className="flex flex-1 items-end justify-between gap-3 p-4">
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-semibold text-[var(--color-ink)]">
                          <Link href={productHref(product)} className="hover:text-[var(--color-accent)]">
                            {product.name}
                          </Link>
                        </h3>
                        <p className="mt-1 flex flex-wrap items-baseline gap-x-2">
                          {price ? <span className="font-extrabold text-[var(--color-ink)]">{price}</span> : null}
                          {off ? (
                            <span className="text-xs text-[var(--color-muted)] line-through">{formatMoney(product.compareAtPrice!, product.currency)}</span>
                          ) : null}
                        </p>
                        {!product.available ? <p className="text-xs text-[var(--color-muted)]">Out of stock</p> : null}
                      </div>
                      <AddToCartIcon product={product} href={productHref(product)} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : null
  );

  return (
    <div className="space-y-12 sm:space-y-14">
      {hero.enabled !== false ? (
        <section
          data-theme-section="hero"
          aria-labelledby="shopease-hero"
          className="relative overflow-hidden rounded-3xl text-white"
          style={{ backgroundColor: DARK }}
        >
          <div className="grid items-center gap-8 px-6 py-10 sm:px-10 lg:grid-cols-[1.1fr_1fr] lg:py-14">
            <div className="space-y-6">
              {branding.tagline?.trim() ? (
                <p className="inline-flex rounded-md bg-white/10 px-3 py-1.5 text-xs font-bold uppercase tracking-wider">
                  {branding.tagline.trim()}
                </p>
              ) : null}
              <h1 id="shopease-hero" className="text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
                {headTop}
                {headAccent ? (
                  <>
                    <br />
                    <span className="text-[var(--color-accent)]">{headAccent}</span>
                  </>
                ) : null}
              </h1>
              {hero.subheadline?.trim() || store.description ? (
                <p className="max-w-md text-lg text-white/80">{hero.subheadline?.trim() || store.description}</p>
              ) : null}
              <ul className="flex flex-wrap gap-x-6 gap-y-3" aria-label="Why shop with us">
                {HERO_POINTS.map((point) => (
                  <li key={point.title} className="flex items-center gap-2.5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[var(--theme-secondary,#0f2b20)]">
                      <Icon name={point.icon} className="h-4 w-4" />
                    </span>
                    <span className="text-sm leading-tight">
                      <span className="block font-semibold">{point.title}</span>
                      <span className="text-white/70">{point.text}</span>
                    </span>
                  </li>
                ))}
              </ul>
              <Link
                href={withStoreParam(hero.ctaHref || '/products', storeSlug)}
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-accent)] px-6 py-3 text-sm font-bold uppercase tracking-wide text-white shadow-lg hover:bg-[var(--color-accent-hover)]"
              >
                {hero.ctaLabel?.trim() || 'Explore collection'}
                <Icon name="arrow" className="h-4 w-4" />
              </Link>
            </div>
            <div className="relative mx-auto w-full max-w-md">
              <div className="aspect-square overflow-hidden rounded-[2rem] bg-[#e9dfd3]">
                {hero.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={hero.imageUrl} alt="" className="h-full w-full object-cover" />
                ) : heroImageProduct ? (
                  <ProductImage product={heroImageProduct} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-[#0f2b20]/40">
                    <Icon name="bag" className="h-24 w-24" />
                  </div>
                )}
              </div>
              {badge ? (
                <p
                  data-testid="hero-offer-badge"
                  className="absolute -right-2 -top-3 flex h-28 w-28 flex-col items-center justify-center gap-0.5 rounded-full bg-[var(--color-accent)] px-2 text-center font-extrabold leading-none text-white shadow-xl sm:h-32 sm:w-32"
                >
                  {badge.top ? <span className="text-sm">{badge.top}</span> : null}
                  {badge.main ? (
                    <span className={badge.main.length > 7 ? 'text-lg' : badge.main.length > 4 ? 'text-2xl' : 'text-4xl'}>{badge.main}</span>
                  ) : null}
                  {badge.bottom ? <span className="text-sm">{badge.bottom}</span> : null}
                </p>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      <section aria-label="Why shop with us" className="rounded-2xl bg-[var(--color-surface)] px-4 py-5 sm:px-6">
        <ul className="grid grid-cols-2 gap-5 lg:grid-cols-4">
          {TRUST.map((item) => (
            <li key={item.title} className="flex items-center gap-3">
              <span className="text-[var(--color-ink)]">
                <Icon name={item.icon} className="h-8 w-8" />
              </span>
              <span className="text-sm leading-tight">
                <span className="block font-bold text-[var(--color-ink)]">{item.title}</span>
                <span className="text-[var(--color-muted)]">{item.text}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      {homeList.map((section, index) =>
        section.type === 'featured_categories' ? (
          <Fragment key={section.type}>{categoriesBlock}</Fragment>
        ) : section.type === 'deal_of_day' ? (
          <Fragment key={section.type}>{renderDeal(section)}</Fragment>
        ) : section.type === 'featured_products' ? (
          <Fragment key={section.type}>
            {dealListed ? null : renderDeal(null)}
            {productsBlock}
          </Fragment>
        ) : (
          <ContentSection key={section.id ?? index} section={section} index={index} storeSlug={storeSlug} />
        ),
      )}

      <section aria-labelledby="shopease-track" className="flex flex-col items-start justify-between gap-4 rounded-2xl px-6 py-6 text-white sm:flex-row sm:items-center sm:px-8" style={{ backgroundColor: DARK }}>
        <div className="flex items-center gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--color-accent)]">
            <Icon name="box" className="h-6 w-6" />
          </span>
          <div>
            <h2 id="shopease-track" className="text-lg font-bold">Already ordered?</h2>
            <p className="text-sm text-white/75">Track your order any time with your order number and phone.</p>
          </div>
        </div>
        <Link
          href={withStoreParam('/track-order', storeSlug)}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-accent)] px-6 py-3 text-sm font-bold uppercase tracking-wide text-white hover:bg-[var(--color-accent-hover)]"
        >
          Track order <Icon name="arrow" className="h-4 w-4" />
        </Link>
      </section>
    </div>
  );
}
