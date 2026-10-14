'use client';

import type { ReactNode } from 'react';
import type { LandingValue } from '@ecomesta/utils';
import { FaqList, LazyVideo, LpIcon, Pic, Stars, initialsOf, useStickyBar } from '../landing-bits';
import {
  asItems,
  asText,
  discountPercent,
  itemText,
  linePrice,
  money,
  toBn,
  useLanding,
  useTimeLeft,
} from '../landing-context';
import { LandingOrderForm, type OrderSkin } from '../landing-order-form';
import { QuantityStepper, VariantPills } from '../landing-pickers';

type S = Record<string, LandingValue>;

const CTA =
  'inline-flex h-14 items-center justify-center rounded-full bg-sp-cta px-8 text-lg font-bold text-white hover:bg-sp-cta-dark focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sp-cta/30';

const ORDER_SKIN: OrderSkin = {
  form: 'rounded-3xl border border-sp-line bg-white p-5 shadow-sm sm:p-8',
  label: 'mb-1.5 block font-semibold',
  required: 'text-sp-sale',
  input: 'h-12 w-full rounded-xl border border-slate-300 px-4 text-base outline-none focus:border-sp-brand focus:ring-2 focus:ring-sp-brand/20',
  inputInvalid: 'border-sp-sale',
  select: 'h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base outline-none focus:border-sp-brand focus:ring-2 focus:ring-sp-brand/20 disabled:opacity-60',
  error: 'mt-1.5 text-sm font-medium text-sp-sale',
  choice:
    'flex cursor-pointer items-center gap-3.5 rounded-2xl border-[1.5px] border-slate-300 px-4 py-3.5 has-[:checked]:border-sp-ink has-[:checked]:bg-sp-mist has-[:checked]:ring-1 has-[:checked]:ring-sp-ink has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-sp-brand',
  choiceTitle: 'block font-semibold',
  choiceHint: 'block text-sm text-slate-600',
  choicePrice: 'font-bold',
  radio: 'h-5 w-5 accent-[rgb(var(--sp-brand))]',
  summary: 'flex flex-col gap-3 rounded-2xl bg-sp-mist p-5',
  summaryLabel: 'text-slate-600',
  summaryValue: 'font-semibold',
  totalLabel: 'text-lg font-bold',
  totalValue: 'text-2xl font-bold text-sp-brand',
  divider: 'h-px bg-slate-300',
  savingValue: 'font-semibold text-sp-sale',
  formError: 'mb-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-sp-sale',
  button: 'h-14 w-full rounded-full bg-sp-cta text-lg font-bold text-white hover:bg-sp-cta-dark focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sp-cta/30 disabled:opacity-60',
  note: 'pt-3 text-center text-sm text-slate-600',
  success: {
    box: 'rounded-3xl border border-sp-line bg-white px-5 py-10 text-center shadow-sm focus:outline-none',
    icon: 'mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-sp-brand-soft text-sp-brand',
    title: 'mb-2 text-2xl font-bold',
    text: 'text-slate-700',
    total: 'pt-4 text-lg font-bold text-sp-brand',
    link: 'mt-5 inline-flex h-11 items-center rounded-full border border-sp-line px-6 font-semibold text-sp-brand hover:bg-sp-mist',
  },
};

function ScrollButton({ label, className = '', hero }: { label: string; className?: string; hero?: boolean }) {
  const { scrollTo } = useLanding();
  if (!label) return null;
  return (
    <button type="button" data-hero-cta={hero ? '' : undefined} onClick={() => scrollTo('order')} className={`${CTA} ${className}`}>
      {label}
    </button>
  );
}

function PriceLine({ className = 'text-4xl', oldClass = 'text-xl' }: { className?: string; oldClass?: string }) {
  const { products, lines, currency } = useLanding();
  const product = products[0];
  const { price, compareAt } = linePrice(product, lines[0]?.variantId ?? null);
  if (!product) return null;
  return (
    <div className="flex items-baseline gap-3">
      <span className={`${className} font-bold text-sp-brand`}>{money(price, currency)}</span>
      {compareAt && compareAt > price ? <span className={`${oldClass} text-slate-500 line-through`}>{money(compareAt, currency)}</span> : null}
    </div>
  );
}

function Hero({ s }: { s: S }) {
  const { products, lines } = useLanding();
  const product = products[0];
  const { price, compareAt } = linePrice(product, lines[0]?.variantId ?? null);
  const off = discountPercent(price, compareAt);
  const image = asText(s.imageUrl) || product?.imageUrl || '';
  return (
    <section data-section="hero" className="bg-sp-brand-soft">
      <div className="mx-auto grid max-w-6xl items-center gap-6 px-4 pb-8 pt-5 md:grid-cols-2 md:gap-12 md:py-14">
        <div className="relative">
          <Pic src={image} alt={product?.name ?? ''} eager className="aspect-[4/5] w-full rounded-3xl bg-white object-cover md:aspect-square" />
          {off > 0 ? <span className="absolute left-3 top-3 rounded-full bg-sp-sale px-3.5 py-1.5 text-sm font-bold text-white">{toBn(off)}% ছাড়</span> : null}
        </div>
        <div className="flex flex-col gap-4">
          {asText(s.badge) ? (
            <span className="self-start rounded-full border border-sp-brand/20 bg-white px-3.5 py-1.5 text-sm font-semibold text-sp-brand">{asText(s.badge)}</span>
          ) : null}
          <h1 className="text-3xl font-bold leading-tight md:text-5xl">{asText(s.title)}</h1>
          {asText(s.subtitle) ? <p className="text-lg text-slate-700">{asText(s.subtitle)}</p> : null}
          <PriceLine />
          <ScrollButton label={asText(s.buttonLabel)} hero className="w-full sm:w-auto sm:self-start" />
          <ul className="flex flex-col gap-2 text-[15px] text-slate-700">
            {asItems(s.points).map((point, i) => (
              <li key={i} className="flex items-center gap-2">
                <LpIcon name="check" className="h-5 w-5 shrink-0 text-sp-brand" />
                {itemText(point, 'text')}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function Countdown({ s }: { s: S }) {
  const { countdownEnd } = useLanding();
  const t = useTimeLeft(countdownEnd);
  if (countdownEnd === null) return null;
  const cell = (value: string, label: string) => (
    <div className="flex flex-col items-center">
      <span className="min-w-[56px] rounded-xl bg-white/10 py-2 text-center text-2xl font-bold tabular-nums">{value}</span>
      <span className="pt-1 text-xs text-slate-300">{label}</span>
    </div>
  );
  return (
    <section data-section="countdown" className="bg-sp-ink text-white">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-center gap-4 px-4 py-6 text-center md:flex-row md:gap-10">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <LpIcon name="clock" className="h-6 w-6 text-amber-300" />
          {asText(s.title)}
        </div>
        <div className="flex items-center gap-3" aria-label="অফার শেষ হওয়ার কাউন্টডাউন">
          {t.hasDays ? cell(t.days, 'দিন') : null}
          {cell(t.hours, 'ঘণ্টা')}
          <span className="pb-5 text-2xl font-bold" aria-hidden="true">:</span>
          {cell(t.minutes, 'মিনিট')}
          <span className="pb-5 text-2xl font-bold" aria-hidden="true">:</span>
          {cell(t.seconds, 'সেকেন্ড')}
        </div>
        <ScrollButton label={asText(s.buttonLabel)} className="h-12 w-full px-7 text-base md:w-auto" />
      </div>
    </section>
  );
}

function Heading({ children }: { children: ReactNode }) {
  return <h2 className="mb-8 text-center text-2xl font-bold md:text-3xl">{children}</h2>;
}

function Benefits({ s }: { s: S }) {
  return (
    <section data-section="benefits" className="py-10 md:py-16">
      <div className="mx-auto max-w-6xl px-4">
        <Heading>{asText(s.title)}</Heading>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {asItems(s.items).map((item, i) => (
            <div key={i} className="flex gap-4 rounded-2xl border border-sp-line p-5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-sp-brand-soft text-sp-brand">
                <LpIcon name={itemText(item, 'icon')} className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold">{itemText(item, 'title')}</h3>
                <p className="text-slate-600">{itemText(item, 'text')}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="pt-8 text-center">
          <ScrollButton label={asText(s.buttonLabel)} className="w-full px-10 sm:w-auto" />
        </div>
      </div>
    </section>
  );
}

function Gallery({ s }: { s: S }) {
  const images = asItems(s.images).filter((i) => itemText(i, 'imageUrl'));
  if (images.length === 0) return null;
  return (
    <section data-section="gallery" className="bg-sp-mist py-10 md:py-16">
      <div className="mx-auto max-w-6xl px-4">
        <Heading>{asText(s.title)}</Heading>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
          {images.map((img, i) => (
            <Pic key={i} src={itemText(img, 'imageUrl')} alt={itemText(img, 'alt')} className="aspect-[4/5] w-full rounded-2xl object-cover" />
          ))}
        </div>
      </div>
    </section>
  );
}

function Video({ s }: { s: S }) {
  return (
    <section data-section="video" className="py-10 md:py-16">
      <div className="mx-auto max-w-3xl px-4">
        <Heading>{asText(s.title)}</Heading>
        <LazyVideo
          url={asText(s.videoUrl)}
          poster={asText(s.posterUrl)}
          className="rounded-3xl bg-sp-brand-soft"
          buttonClass="flex h-20 w-20 items-center justify-center rounded-full bg-sp-cta text-white shadow-lg"
          noteClass="absolute inset-x-3 bottom-3 rounded-lg bg-white/90 px-3 py-2 text-center text-sm text-slate-700"
        />
      </div>
    </section>
  );
}

function Reviews({ s }: { s: S }) {
  const shots = asItems(s.screenshots).filter((i) => itemText(i, 'imageUrl'));
  return (
    <section data-section="reviews" className="bg-sp-mist py-10 md:py-16">
      <div className="mx-auto max-w-6xl px-4">
        <h2 className="mb-2 text-center text-2xl font-bold md:text-3xl">{asText(s.title)}</h2>
        {asText(s.subtitle) ? <p className="mb-8 text-center text-slate-600">{asText(s.subtitle)}</p> : <div className="mb-6" />}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {asItems(s.items).map((review, i) => (
            <article key={i} className="flex flex-col gap-3 rounded-2xl border border-sp-line bg-white p-5">
              <span className="text-sp-star">
                <Stars rating={Number(review.rating)} />
              </span>
              <p>{itemText(review, 'text')}</p>
              <div className="flex items-center gap-3 pt-1">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-sp-brand-soft font-bold text-sp-brand">{initialsOf(itemText(review, 'name'))}</span>
                <div>
                  <div className="font-semibold">{itemText(review, 'name')}</div>
                  <div className="text-sm text-slate-600">{itemText(review, 'location')}</div>
                </div>
              </div>
            </article>
          ))}
          {shots.map((shot, i) => (
            <Pic key={`s${i}`} src={itemText(shot, 'imageUrl')} alt="ক্রেতার রিভিউয়ের স্ক্রিনশট" className="w-full rounded-2xl border border-sp-line bg-white object-cover" />
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
        <Heading>{asText(s.title)}</Heading>
        <div className="flex flex-col gap-3">
          <FaqList
            firstOpen
            items={asItems(s.items)}
            skin={{
              item: 'rounded-2xl border border-sp-line',
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

function Guarantee({ s }: { s: S }) {
  return (
    <section data-section="guarantee" className="bg-sp-brand-soft py-10 md:py-14">
      <div className="mx-auto max-w-6xl px-4">
        <Heading>{asText(s.title)}</Heading>
        <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
          {asItems(s.items).map((item, i) => (
            <div key={i} className="flex flex-col items-center gap-2 rounded-2xl bg-white p-5 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-sp-brand-soft text-sp-brand">
                <LpIcon name={itemText(item, 'icon')} className="h-7 w-7" />
              </div>
              <h3 className="font-bold">{itemText(item, 'title')}</h3>
              <p className="text-sm text-slate-600">{itemText(item, 'text')}</p>
            </div>
          ))}
        </div>
        <div className="pt-8 text-center">
          <ScrollButton label={asText(s.buttonLabel)} className="w-full px-10 sm:w-auto" />
        </div>
      </div>
    </section>
  );
}

function ProductPicker() {
  const { products, lines, setOnlyLine, currency } = useLanding();
  const product = products[0];
  if (!product) return <p className="py-6 text-center text-slate-600">এই অফারটি এখন পাওয়া যাচ্ছে না।</p>;
  const line = lines[0];
  const { price, compareAt, variantName } = linePrice(product, line?.variantId ?? null);
  const quantity = line?.quantity ?? 1;
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4 border-b border-sp-line pb-5">
        <Pic src={product.imageUrl ?? ''} className="h-20 w-20 shrink-0 rounded-2xl object-cover" />
        <div className="min-w-0">
          <div className="text-lg font-bold leading-snug">{product.name}</div>
          {variantName ? <div className="text-sm text-slate-600">{variantName}</div> : null}
          <div className="flex items-baseline gap-2 pt-0.5">
            <span className="font-bold text-sp-brand">{money(price, currency)}</span>
            {compareAt && compareAt > price ? <span className="text-sm text-slate-500 line-through">{money(compareAt, currency)}</span> : null}
          </div>
        </div>
      </div>
      <VariantPills
        product={product}
        value={line?.variantId ?? null}
        onChange={(variantId) => setOnlyLine(product.id, variantId, quantity)}
        label="সাইজ / ধরন"
        skin={{
          label: 'mb-2 font-semibold',
          group: 'flex flex-wrap gap-2.5',
          pill: 'flex h-12 min-w-[64px] items-center justify-center rounded-xl border-[1.5px] border-slate-300 px-4 font-semibold peer-checked:border-sp-ink peer-checked:bg-sp-ink peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-sp-brand peer-focus-visible:ring-offset-2',
        }}
      />
      <div className="flex items-center justify-between gap-4">
        <span className="font-semibold">পরিমাণ</span>
        <QuantityStepper
          value={quantity}
          onChange={(next) => line && setOnlyLine(product.id, line.variantId, next)}
          skin={{
            box: 'flex h-12 items-center rounded-full border-[1.5px] border-slate-300 px-1',
            button: 'h-11 w-11 rounded-full text-2xl hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent',
            value: 'min-w-[36px] text-center text-lg font-bold',
          }}
        />
      </div>
    </div>
  );
}

function Order({ s }: { s: S }) {
  return (
    <section data-section="order" id="order" className="scroll-mt-2 bg-sp-mist py-10 md:py-16">
      <div className="mx-auto max-w-2xl px-4">
        <header className="mb-6 text-center">
          <h2 className="text-2xl font-bold md:text-3xl">{asText(s.title)}</h2>
          {asText(s.subtitle) ? <p className="pt-1 text-slate-600">{asText(s.subtitle)}</p> : null}
        </header>
        <LandingOrderForm
          skin={ORDER_SKIN}
          texts={{ buttonLabel: asText(s.buttonLabel) || 'অর্ডার কনফার্ম করুন', successText: asText(s.successText) }}
          products={<ProductPicker />}
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
    <footer data-section="footer" className="bg-sp-ink text-slate-300">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 text-center md:flex-row md:items-center md:justify-between md:text-left">
        <div>
          <div className="text-2xl font-bold text-white">{brand}</div>
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
      <div className="border-t border-white/15 px-4 py-4 text-center text-sm">
        © {new Date().getFullYear()} {brand}। Powered by Ecomesta
      </div>
    </footer>
  );
}

function StickyBar() {
  const { scrollTo, settings } = useLanding();
  const show = useStickyBar();
  const label = asText(settings('hero')?.buttonLabel) || 'অর্ডার করুন';
  return (
    <div
      aria-hidden={!show}
      className={`fixed inset-x-0 bottom-0 z-50 border-t border-sp-line bg-white px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-4px_16px_rgba(0,0,0,0.08)] transition-transform duration-200 md:hidden ${show ? 'translate-y-0' : 'invisible translate-y-full'}`}
    >
      <div className="flex items-center gap-3">
        <div className="leading-tight">
          <PriceLine className="text-xl" oldClass="text-sm" />
        </div>
        <button type="button" tabIndex={show ? 0 : -1} onClick={() => scrollTo('order')} className={`${CTA} h-12 flex-1 px-4`}>
          {label}
        </button>
      </div>
    </div>
  );
}

const SECTIONS: Record<string, (props: { s: S }) => ReactNode> = {
  hero: Hero,
  countdown: Countdown,
  benefits: Benefits,
  gallery: Gallery,
  video: Video,
  reviews: Reviews,
  faq: Faq,
  guarantee: Guarantee,
  order: Order,
  footer: Footer,
};

export function SingleProductTemplate() {
  const { content } = useLanding();
  return (
    <div className="bg-white pb-24 font-sans text-sp-ink antialiased md:pb-0">
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
