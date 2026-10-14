'use client';

import { useState, type ReactNode } from 'react';
import type { LandingValue } from '@ecomesta/utils';
import { FaqList, LpIcon, Pic, Stars, useStickyBar } from '../landing-bits';
import {
  asItems,
  asText,
  discountPercent,
  itemText,
  maxDiscount,
  money,
  toBn,
  useLanding,
  useTimeLeft,
  type LandingProduct,
} from '../landing-context';
import { LandingOrderForm, type OrderSkin } from '../landing-order-form';
import { CartList, useLinesTotal } from '../landing-pickers';

type S = Record<string, LandingValue>;

const BTN =
  'inline-flex h-14 items-center justify-center rounded-full bg-cp-maroon px-10 text-lg font-bold text-white hover:bg-cp-maroon-dark focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cp-maroon/30';

const ORDER_SKIN: OrderSkin = {
  form: 'rounded-3xl border-2 border-cp-gold bg-cp-cream p-5 sm:p-8',
  label: 'mb-1.5 block font-semibold',
  required: 'text-cp-sale',
  input: 'h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-base outline-none focus:border-cp-maroon focus:ring-2 focus:ring-cp-maroon/20',
  inputInvalid: 'border-cp-sale',
  select: 'h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base outline-none focus:border-cp-maroon focus:ring-2 focus:ring-cp-maroon/20 disabled:opacity-60',
  error: 'mt-1.5 text-sm font-semibold text-cp-sale',
  choice:
    'flex cursor-pointer items-center gap-3.5 rounded-2xl border-[1.5px] border-slate-300 bg-white px-4 py-3.5 has-[:checked]:border-cp-maroon has-[:checked]:ring-1 has-[:checked]:ring-cp-maroon has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-cp-maroon',
  choiceTitle: 'block font-semibold',
  choiceHint: 'block text-sm text-slate-600',
  choicePrice: 'font-bold',
  radio: 'h-5 w-5 accent-[rgb(var(--cp-maroon))]',
  summary: 'flex flex-col gap-3 rounded-2xl border border-cp-line bg-white p-5',
  summaryLabel: 'text-slate-600',
  summaryValue: 'font-semibold',
  totalLabel: 'text-lg font-bold',
  totalValue: 'text-2xl font-bold text-cp-maroon',
  divider: 'h-px bg-cp-line',
  savingValue: 'font-semibold text-cp-sale',
  formError: 'mb-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-cp-sale',
  button: 'h-14 w-full rounded-full bg-cp-maroon text-lg font-bold text-white hover:bg-cp-maroon-dark focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cp-maroon/30 disabled:opacity-60',
  note: 'pt-3 text-center text-sm text-slate-600',
  success: {
    box: 'rounded-3xl border-2 border-cp-gold bg-cp-cream px-5 py-10 text-center focus:outline-none',
    icon: 'mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-cp-gold-soft text-cp-maroon',
    title: 'mb-2 font-display text-3xl text-cp-maroon',
    text: 'text-slate-700',
    total: 'pt-4 text-lg font-bold text-cp-maroon',
    link: 'mt-5 inline-flex h-11 items-center rounded-full border-2 border-cp-maroon px-6 font-semibold text-cp-maroon hover:bg-cp-gold-soft',
  },
};

function Star8({ className = 'text-cp-gold' }: { className?: string }) {
  return <LpIcon name="star8" className={`mx-auto h-8 w-8 ${className}`} />;
}

function SectionHeader({ title, subtitle, light }: { title: string; subtitle?: string; light?: boolean }) {
  return (
    <header className="mb-8 text-center">
      <Star8 />
      <h2 className={`pt-1 font-display text-3xl md:text-4xl ${light ? 'text-cp-gold-light' : 'text-cp-maroon'}`}>{title}</h2>
      {subtitle ? <p className={`pt-1 ${light ? 'text-white/85' : 'text-slate-700'}`}>{subtitle}</p> : null}
    </header>
  );
}

function Timer({ big }: { big?: boolean }) {
  const { countdownEnd } = useLanding();
  const t = useTimeLeft(countdownEnd);
  if (countdownEnd === null) return null;
  const cells: [string, string][] = [
    [t.days, 'দিন'],
    [t.hours, 'ঘণ্টা'],
    [t.minutes, 'মিনিট'],
    [t.seconds, 'সেকেন্ড'],
  ];
  if (big) {
    return (
      <div className="mx-auto mt-5 grid max-w-xl grid-cols-4 gap-2 sm:gap-4" aria-label="অফার শেষ হওয়ার কাউন্টডাউন">
        {cells.map(([value, label]) => (
          <div key={label} className="rounded-2xl border-2 border-cp-gold bg-cp-maroon py-3 text-white sm:py-4">
            <div className="text-3xl font-bold tabular-nums sm:text-5xl">{value}</div>
            <div className="pt-1 text-xs text-cp-gold-light sm:text-sm">{label}</div>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2" aria-label="অফার শেষ হওয়ার কাউন্টডাউন">
      {cells.map(([value, label], i) => (
        <div key={label} className="flex items-center gap-2">
          {i > 0 ? <span className="pb-5 font-bold text-cp-gold" aria-hidden="true">:</span> : null}
          <div className="flex flex-col items-center">
            <span className="min-w-[52px] rounded-lg border border-cp-gold/40 bg-cp-maroon-deep py-1.5 text-center text-xl font-bold tabular-nums">{value}</span>
            <span className="pt-1 text-xs text-cp-gold-light">{label}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function Announcement({ s }: { s: S }) {
  if (!asText(s.text)) return null;
  return (
    <section data-section="announcement" className="bg-cp-gold text-cp-maroon-deep">
      <div className="mx-auto max-w-6xl px-4 py-2 text-center text-sm font-semibold">{asText(s.text)}</div>
    </section>
  );
}

function Hero({ s }: { s: S }) {
  const { products, scrollTo } = useLanding();
  const best = maxDiscount(products);
  return (
    <section data-section="hero" className="lp-cp-pattern relative overflow-hidden bg-cp-maroon text-white">
      <svg viewBox="0 0 24 40" aria-hidden="true" className="lp-lantern absolute left-3 top-0 h-[53px] w-8 text-cp-gold md:left-[8%] md:h-20 md:w-12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 0v6M8 6h8l1 3H7zM7 9l-2 9 2 9h10l2-9-2-9M12 9v18M9.5 9L8 27M14.5 9L16 27M8 27h8l-1 3H9zM12 30v5" />
        <circle cx="12" cy="37" r="1.5" />
      </svg>
      <svg viewBox="0 0 24 40" aria-hidden="true" style={{ animationDelay: '-2s' }} className="lp-lantern absolute left-16 top-0 h-10 w-6 text-cp-gold-light md:left-[14%] md:h-[60px] md:w-9" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 0v6M8 6h8l1 3H7zM7 9l-2 9 2 9h10l2-9-2-9M12 9v18M9.5 9L8 27M14.5 9L16 27M8 27h8l-1 3H9zM12 30v5" />
        <circle cx="12" cy="37" r="1.5" />
      </svg>
      <LpIcon name="moonFill" className="absolute right-4 top-4 h-12 w-12 text-cp-gold md:right-[8%] md:top-8 md:h-20 md:w-20" />
      <LpIcon name="star" className="lp-twinkle absolute right-[72px] top-8 h-4 w-4 text-cp-gold-light md:right-[16%] md:top-12 md:h-6 md:w-6" />

      <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 pb-10 pt-20 md:grid-cols-[1.15fr_0.85fr] md:py-24">
        <div className="flex flex-col gap-5">
          {asText(s.badge) ? (
            <span className="self-start rounded-full border border-cp-gold/60 bg-cp-maroon-dark px-4 py-1.5 text-sm font-semibold text-cp-gold-light">{asText(s.badge)}</span>
          ) : null}
          <h1 className="font-display text-5xl leading-[1.15] md:text-7xl">{asText(s.title)}</h1>
          {best > 0 ? (
            <div className="flex items-center gap-4">
              <div className="font-display leading-none text-cp-gold">
                <span className="text-7xl md:text-8xl">{toBn(best)}</span>
                <span className="text-4xl md:text-5xl">%</span>
              </div>
              <div className="whitespace-pre-line text-xl font-semibold leading-tight md:text-2xl">{asText(s.discountSuffix)}</div>
            </div>
          ) : null}
          {asText(s.subtitle) ? <p className="max-w-md text-lg text-white/85">{asText(s.subtitle)}</p> : null}
          {s.showCountdown !== false ? <Timer /> : null}
          <div className="flex flex-col gap-3 pt-1 sm:flex-row">
            {asText(s.buttonLabel) ? (
              <button type="button" data-hero-cta="" onClick={() => scrollTo('order')} className="inline-flex h-14 items-center justify-center rounded-full bg-cp-gold px-9 text-lg font-bold text-cp-maroon-deep hover:bg-cp-gold-light focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cp-gold/40">
                {asText(s.buttonLabel)}
              </button>
            ) : null}
            {asText(s.secondaryLabel) ? (
              <button type="button" onClick={() => scrollTo('offer_products')} className="inline-flex h-14 items-center justify-center rounded-full border-2 border-cp-gold px-9 text-lg font-semibold text-cp-gold-light hover:bg-white/10">
                {asText(s.secondaryLabel)}
              </button>
            ) : null}
          </div>
        </div>
        <div className="mx-auto w-full max-w-[300px] rounded-b-3xl rounded-t-[999px] border-4 border-cp-gold bg-cp-maroon-dark p-2 md:max-w-sm">
          <Pic src={asText(s.imageUrl)} alt={asText(s.title)} eager className="aspect-[3/4] w-full rounded-b-2xl rounded-t-[999px] bg-cp-gold-soft object-cover" />
        </div>
      </div>
    </section>
  );
}

function Countdown({ s }: { s: S }) {
  const { scrollTo, countdownEnd } = useLanding();
  if (countdownEnd === null) return null;
  return (
    <section data-section="countdown" className="border-y border-cp-gold/50 bg-cp-gold-soft">
      <div className="mx-auto max-w-4xl px-4 py-8 text-center md:py-10">
        <h2 className="font-display text-2xl text-cp-maroon md:text-3xl">{asText(s.title)}</h2>
        {asText(s.subtitle) ? <p className="pt-1 text-slate-700">{asText(s.subtitle)}</p> : null}
        <Timer big />
        {asText(s.buttonLabel) ? (
          <button type="button" onClick={() => scrollTo('order')} className={`${BTN} mt-6 w-full sm:w-auto`}>
            {asText(s.buttonLabel)}
          </button>
        ) : null}
      </div>
    </section>
  );
}

/** One offer product: picture, price, variant and "add" (combo cards are wider). */
function ProductCard({ product, addLabel, wide }: { product: LandingProduct; addLabel: string; wide?: boolean }) {
  const { addLine, currency } = useLanding();
  const [variantId, setVariantId] = useState('');
  const [error, setError] = useState('');
  const [added, setAdded] = useState(false);
  const variant = product.variants.find((v) => v.id === variantId);
  const price = variant?.price ?? product.price;
  const compareAt = variant ? variant.compareAt : product.compareAt;
  const off = discountPercent(price, compareAt);
  const soldOut = !product.available;

  const add = () => {
    if (product.variants.length > 0 && !variant) {
      setError('আগে বাছাই করুন');
      return;
    }
    setError('');
    addLine(product.id, variant?.id ?? null);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1600);
  };

  const picker =
    product.variants.length > 0 ? (
      <select
        aria-label={`${product.name}: বাছাই করুন`}
        value={variantId}
        onChange={(e) => {
          setVariantId(e.target.value);
          setError('');
        }}
        className="h-11 w-full rounded-lg border border-slate-300 bg-white px-2 text-base"
      >
        <option value="">বাছাই করুন</option>
        {product.variants.map((v) => (
          <option key={v.id} value={v.id} disabled={!v.available}>
            {v.name}
            {v.available ? '' : ' (স্টক শেষ)'}
          </option>
        ))}
      </select>
    ) : null;

  const button = (
    <button
      type="button"
      onClick={add}
      disabled={soldOut}
      className={`mt-auto rounded-full bg-cp-maroon font-bold text-white hover:bg-cp-maroon-dark focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cp-maroon/30 disabled:bg-slate-300 disabled:text-slate-600 ${wide ? 'h-12' : 'h-11'}`}
    >
      {soldOut ? 'স্টক শেষ' : added ? '✓ যোগ হয়েছে' : addLabel}
    </button>
  );

  if (wide) {
    return (
      <article className="relative flex flex-col overflow-hidden rounded-3xl border-2 border-cp-gold bg-cp-cream text-cp-ink sm:flex-row">
        <div className="relative shrink-0 sm:w-2/5">
          <Pic src={product.imageUrl ?? ''} alt={product.name} className="h-56 w-full bg-cp-gold-soft object-cover sm:h-full" />
          {off > 0 ? <span className="absolute left-3 top-3 rounded-full bg-cp-sale px-3 py-1 text-sm font-bold text-white">{toBn(off)}% ছাড়</span> : null}
        </div>
        <div className="flex flex-1 flex-col gap-2.5 p-5">
          <h3 className="font-display text-2xl leading-snug text-cp-maroon">{product.name}</h3>
          {product.note ? <p className="text-slate-700">{product.note}</p> : null}
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-2xl font-bold text-cp-maroon">{money(price, currency)}</span>
            {compareAt && compareAt > price ? <span className="text-base text-slate-500 line-through">{money(compareAt, currency)}</span> : null}
          </div>
          {picker}
          {error ? <p role="alert" className="text-sm font-semibold text-cp-sale">{error}</p> : null}
          {button}
        </div>
      </article>
    );
  }

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-cp-line bg-white">
      <div className="relative">
        <Pic src={product.imageUrl ?? ''} alt={product.name} className="aspect-[4/5] w-full bg-cp-gold-soft object-cover" />
        {off > 0 ? <span className="absolute left-2 top-2 rounded-full bg-cp-sale px-2.5 py-1 text-xs font-bold text-white">{toBn(off)}% ছাড়</span> : null}
        {soldOut ? <span className="absolute inset-x-0 bottom-0 bg-cp-maroon/90 px-2 py-1 text-center text-xs font-semibold text-cp-gold-light">স্টক শেষ</span> : null}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <h3 className="font-semibold leading-snug">{product.name}</h3>
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-lg font-bold text-cp-maroon">{money(price, currency)}</span>
          {compareAt && compareAt > price ? <span className="text-sm text-slate-500 line-through">{money(compareAt, currency)}</span> : null}
        </div>
        {picker}
        {error ? <p role="alert" className="text-sm font-semibold text-cp-sale">{error}</p> : null}
        {button}
      </div>
    </article>
  );
}

function OfferProducts({ s }: { s: S }) {
  const { products } = useLanding();
  return (
    <section data-section="offer_products" className="scroll-mt-2 py-10 md:py-16">
      <div className="mx-auto max-w-6xl px-4">
        <SectionHeader title={asText(s.title)} subtitle={asText(s.subtitle)} />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5 lg:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} addLabel={asText(s.addLabel) || 'যোগ করুন'} />
          ))}
        </div>
      </div>
    </section>
  );
}

function Combo({ s }: { s: S }) {
  const { productById, preview } = useLanding();
  const ids = Array.isArray(s.productIds) ? (s.productIds as string[]) : [];
  const combos = ids.map((id) => productById(id)).filter((p): p is LandingProduct => !!p && !p.demo);
  // Shoppers never see an empty combo band; the editor's preview explains what to do.
  if (combos.length === 0 && !preview) return null;
  return (
    <section data-section="combo" className="lp-cp-pattern bg-cp-maroon py-10 text-white md:py-16">
      <div className="mx-auto max-w-6xl px-4">
        <SectionHeader title={asText(s.title)} subtitle={asText(s.subtitle)} light />
        {combos.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-cp-gold/60 p-6 text-center text-cp-gold-light">এডিটরে এই সেকশনের জন্য ১-২টি কম্বো পণ্য বাছাই করুন।</p>
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            {combos.map((product) => (
              <ProductCard key={product.id} product={product} addLabel={asText(s.addLabel) || 'যোগ করুন'} wide />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function Benefits({ s }: { s: S }) {
  const { scrollTo } = useLanding();
  return (
    <section data-section="benefits" className="py-10 md:py-16">
      <div className="mx-auto max-w-6xl px-4">
        <SectionHeader title={asText(s.title)} />
        <div className="grid grid-cols-2 gap-3 md:gap-5 lg:grid-cols-4">
          {asItems(s.items).map((item, i) => (
            <div key={i} className="flex flex-col items-center gap-2 rounded-2xl border border-cp-line bg-white p-5 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-cp-gold-soft text-cp-maroon">
                <LpIcon name={itemText(item, 'icon')} className="h-7 w-7" />
              </div>
              <h3 className="font-bold">{itemText(item, 'title')}</h3>
              <p className="text-sm text-slate-600">{itemText(item, 'text')}</p>
            </div>
          ))}
        </div>
        {asText(s.buttonLabel) ? (
          <div className="pt-8 text-center">
            <button type="button" onClick={() => scrollTo('order')} className={`${BTN} w-full sm:w-auto`}>
              {asText(s.buttonLabel)}
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function Reviews({ s }: { s: S }) {
  return (
    <section data-section="reviews" className="bg-cp-gold-soft py-10 md:py-16">
      <div className="mx-auto max-w-6xl px-4">
        <header className="mb-8 text-center">
          <Star8 className="text-cp-maroon" />
          <h2 className="pt-1 font-display text-3xl text-cp-maroon md:text-4xl">{asText(s.title)}</h2>
          {asText(s.subtitle) ? <p className="pt-1 text-slate-700">{asText(s.subtitle)}</p> : null}
        </header>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {asItems(s.items).map((review, i) => (
            <article key={i} className="flex gap-4 rounded-2xl border border-cp-line bg-white p-4">
              {itemText(review, 'imageUrl') ? (
                <Pic src={itemText(review, 'imageUrl')} alt="ক্রেতার ছবি" className="h-28 w-24 shrink-0 rounded-xl bg-cp-gold-soft object-cover" />
              ) : null}
              <div className="flex min-w-0 flex-col gap-1.5">
                <span className="text-amber-500">
                  <Stars rating={Number(review.rating)} />
                </span>
                <p>{itemText(review, 'text')}</p>
                <div className="text-sm">
                  <span className="font-semibold">{itemText(review, 'name')}</span>
                  {itemText(review, 'location') ? <span className="text-slate-600"> · {itemText(review, 'location')}</span> : null}
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Faq({ s }: { s: S }) {
  return (
    <section data-section="faq" className="py-10 md:py-16">
      <div className="mx-auto max-w-3xl px-4">
        <SectionHeader title={asText(s.title)} />
        <div className="flex flex-col gap-3">
          <FaqList
            firstOpen
            items={asItems(s.items)}
            skin={{
              item: 'rounded-2xl border border-cp-line bg-white',
              button: 'flex min-h-[56px] w-full items-center justify-between gap-4 px-5 py-3 text-left text-lg font-semibold',
              panel: 'px-5 pb-5 text-slate-700',
              chevron: 'h-5 w-5',
            }}
          />
        </div>
      </div>
    </section>
  );
}

function Order({ s }: { s: S }) {
  const { scrollTo } = useLanding();
  return (
    <section data-section="order" className="lp-cp-pattern scroll-mt-2 bg-cp-maroon-deep py-10 md:py-16">
      <div className="mx-auto max-w-2xl px-4">
        <header className="mb-6 text-center text-white">
          <h2 className="font-display text-3xl text-cp-gold-light md:text-4xl">{asText(s.title)}</h2>
          {asText(s.subtitle) ? <p className="pt-1 text-white/85">{asText(s.subtitle)}</p> : null}
        </header>
        <LandingOrderForm
          skin={ORDER_SKIN}
          texts={{ buttonLabel: asText(s.buttonLabel) || 'অর্ডার কনফার্ম করুন', successText: asText(s.successText), closingText: asText(s.closingText) }}
          products={
            <div>
              <h3 className="mb-1 text-lg font-semibold">আপনার পণ্য</h3>
              <CartList
                emptyText="উপরে থেকে পণ্য যোগ করুন"
                skin={{
                  box: 'rounded-2xl border border-cp-line bg-white px-4',
                  empty: 'py-8 text-center text-slate-600',
                  item: 'flex gap-3 border-b border-cp-line py-4 last:border-0',
                  image: 'h-[90px] w-[72px] shrink-0 rounded-xl bg-cp-gold-soft object-cover',
                  name: 'font-semibold leading-snug',
                  variant: 'text-sm text-slate-600',
                  remove: '-mr-2 -mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-cp-gold-soft hover:text-cp-sale',
                  stepper: {
                    box: 'flex h-10 items-center rounded-full border-[1.5px] border-slate-300 px-1',
                    button: 'h-9 w-9 rounded-full text-xl hover:bg-cp-gold-soft disabled:opacity-40 disabled:hover:bg-transparent',
                    value: 'min-w-[30px] text-center font-bold',
                  },
                  price: 'font-bold text-cp-maroon',
                  oldPrice: 'text-xs text-slate-500 line-through',
                }}
              />
              <button type="button" onClick={() => scrollTo('offer_products')} className="inline-flex h-11 items-center font-semibold text-cp-maroon underline">
                + আরও পণ্য যোগ করুন
              </button>
            </div>
          }
        />
      </div>
    </section>
  );
}

function Footer({ s }: { s: S }) {
  const { brand } = useLanding();
  const phone = asText(s.phone);
  const facebook = asText(s.facebookUrl);
  return (
    <footer data-section="footer" className="border-t border-cp-gold/30 bg-cp-maroon-deep text-white/80">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 text-center md:flex-row md:items-center md:justify-between md:text-left">
        <div>
          <div className="font-display text-3xl text-cp-gold-light">{brand}</div>
          {asText(s.text) ? <p className="pt-1 text-sm">{asText(s.text)}</p> : null}
        </div>
        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-6">
          {phone ? (
            <a href={`tel:${phone.replace(/[^\d+]/g, '')}`} className="inline-flex h-11 items-center gap-2 font-semibold text-white hover:underline">
              <LpIcon name="phone" className="h-5 w-5" />
              {phone}
            </a>
          ) : null}
          {facebook ? (
            <a href={facebook} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 items-center gap-2 font-semibold text-white hover:underline">
              <LpIcon name="facebook" className="h-5 w-5" />
              Facebook পেজ
            </a>
          ) : null}
        </div>
      </div>
      <div className="border-t border-white/15 px-4 py-4 text-center text-sm">© {new Date().getFullYear()} {brand}। Powered by Ecomesta</div>
    </footer>
  );
}

function StickyBar() {
  const { scrollTo, currency } = useLanding();
  const show = useStickyBar();
  const { count, total } = useLinesTotal();
  return (
    <div
      aria-hidden={!show}
      className={`fixed inset-x-0 bottom-0 z-50 border-t-2 border-cp-gold bg-cp-maroon-deep px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 transition-transform duration-200 md:inset-x-auto md:bottom-6 md:right-6 md:rounded-full md:border-2 md:py-2.5 md:pl-6 md:pr-3 md:shadow-xl ${show ? 'translate-y-0' : 'invisible translate-y-[150%]'}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 font-semibold text-white" aria-live="polite">
          <LpIcon name="bag" className="h-5 w-5 text-cp-gold" />
          {count > 0 ? `${toBn(count)}টি পণ্য · ${money(total, currency)}` : 'কার্ট খালি'}
        </div>
        <button
          type="button"
          tabIndex={show ? 0 : -1}
          onClick={() => scrollTo(count > 0 ? 'order' : 'offer_products')}
          className="inline-flex h-12 items-center justify-center rounded-full bg-cp-gold px-7 text-lg font-bold text-cp-maroon-deep hover:bg-cp-gold-light focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cp-gold/40"
        >
          {count > 0 ? 'অর্ডার করুন' : 'পণ্য বাছুন'}
        </button>
      </div>
    </div>
  );
}

const SECTIONS: Record<string, (props: { s: S }) => ReactNode> = {
  announcement: Announcement,
  hero: Hero,
  countdown: Countdown,
  offer_products: OfferProducts,
  combo: Combo,
  benefits: Benefits,
  reviews: Reviews,
  faq: Faq,
  order: Order,
  footer: Footer,
};

export function CampaignTemplate() {
  const { content } = useLanding();
  return (
    <div className="bg-cp-cream pb-24 font-sans text-cp-ink antialiased md:pb-0">
      <main>
        {content.sections
          .filter((section) => section.enabled)
          .map((section) => {
            const Section = SECTIONS[section.type];
            return Section ? <Section key={section.id} s={section.settings} /> : null;
          })}
      </main>
      <StickyBar />
    </div>
  );
}
