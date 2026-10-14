'use client';

import type { ReactNode } from 'react';
import type { LandingValue } from '@ecomesta/utils';
import { FaqList, LpIcon, Pic, Reveal, Stars, initialsOf, useStickyBar } from '../landing-bits';
import {
  asItems,
  asText,
  itemText,
  linePrice,
  money,
  toBn,
  useLanding,
  useTimeLeft,
  type LandingProduct,
} from '../landing-context';
import { LandingOrderForm, type OrderSkin } from '../landing-order-form';
import { QuantityStepper } from '../landing-pickers';

type S = Record<string, LandingValue>;

const EYEBROW = 'font-display text-sm font-semibold tracking-wide text-fd-leaf';
const H2 = 'mt-2 font-display text-3xl font-bold leading-tight text-fd-bark md:text-5xl';
const HONEY_BTN = 'inline-flex items-center justify-center rounded-full bg-fd-honey font-display font-semibold text-fd-bark shadow-lg transition-colors hover:bg-fd-honey-light';

const ORDER_SKIN: OrderSkin = {
  form: 'rounded-[2rem] bg-white p-5 md:p-10',
  label: 'mb-1.5 block font-medium text-fd-bark',
  input: 'h-12 w-full rounded-2xl border-2 border-fd-line bg-white px-4 text-base placeholder:text-fd-ink/40 focus:border-fd-honey focus:outline-none focus:ring-2 focus:ring-fd-honey-light',
  inputInvalid: 'border-fd-berry',
  select: 'h-12 w-full rounded-2xl border-2 border-fd-line bg-white px-3 text-base focus:border-fd-honey focus:outline-none focus:ring-2 focus:ring-fd-honey-light disabled:opacity-60',
  error: 'mt-1 text-sm text-fd-berry',
  choice:
    'flex cursor-pointer items-center gap-3 rounded-2xl border-2 border-fd-line p-4 has-[:checked]:border-fd-leaf has-[:checked]:bg-fd-leaf-light has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-fd-honey',
  choiceTitle: 'block font-medium',
  choiceHint: 'block text-sm text-fd-ink/70',
  choicePrice: 'font-semibold',
  radio: 'h-4 w-4 accent-[rgb(var(--fd-leaf))]',
  summary: 'space-y-2 rounded-2xl bg-fd-honey-soft p-5',
  summaryLabel: 'text-fd-ink/70',
  summaryValue: '',
  totalLabel: 'font-semibold text-fd-bark',
  totalValue: 'font-display text-3xl font-bold text-fd-leaf-dark',
  divider: 'mt-3 border-t border-fd-honey/40 pt-1',
  savingValue: 'text-fd-leaf-dark',
  formError: 'mb-3 text-center text-sm text-fd-berry',
  button: `${HONEY_BTN} h-14 w-full text-xl disabled:opacity-60`,
  note: 'mt-3 text-center text-sm text-fd-ink/60',
  success: {
    box: 'rounded-[2rem] bg-white p-8 text-center focus:outline-none md:p-12',
    icon: 'mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-fd-leaf text-white',
    title: 'mt-4 font-display text-4xl font-bold text-fd-bark',
    text: 'mt-3 text-lg',
    total: 'mt-2 font-semibold text-fd-leaf-dark',
    link: 'mt-6 inline-flex h-11 items-center rounded-full border-2 border-fd-leaf px-6 font-semibold text-fd-leaf-dark hover:bg-fd-leaf-light',
  },
};

/** The product's packages: its variants, or the product itself. */
function packagesOf(product: LandingProduct | undefined) {
  if (!product) return [];
  if (product.variants.length === 0) return [{ id: null as string | null, name: product.name, price: product.price, compareAt: product.compareAt, available: product.available }];
  return product.variants.map((v) => ({ id: v.id as string | null, name: v.name, price: v.price, compareAt: v.compareAt, available: v.available }));
}

function Timer({ label }: { label: string }) {
  const { countdownEnd } = useLanding();
  const t = useTimeLeft(countdownEnd);
  if (countdownEnd === null) return null;
  return (
    <div className="mt-6">
      {label ? <p className="mb-2 text-sm text-fd-ink/70">{label}</p> : null}
      <div className="inline-flex items-center gap-2 text-center" aria-label="অফার শেষ হতে বাকি সময়">
        {(
          [
            [t.days, 'দিন'],
            [t.hours, 'ঘণ্টা'],
            [t.minutes, 'মিনিট'],
            [t.seconds, 'সেকেন্ড'],
          ] as const
        ).map(([value, unit]) => (
          <div key={unit} className="min-w-[56px] rounded-2xl border border-fd-line bg-white px-2 py-1.5">
            <div className="font-display text-2xl font-bold leading-none text-fd-leaf-dark">{value}</div>
            <div className="text-[11px] text-fd-ink/60">{unit}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Hero({ s }: { s: S }) {
  const { products, lines, brand, scrollTo, currency } = useLanding();
  const product = products[0];
  const line = lines[0];
  const { price, compareAt, variantName } = linePrice(product, line?.variantId ?? null);
  const image = asText(s.imageUrl) || product?.imageUrl || '';
  return (
    <>
      <section data-section="hero" className="relative overflow-hidden bg-fd-honey-soft">
        <LpIcon name="leaf" className="absolute -right-6 -top-4 h-40 w-40 rotate-12 text-fd-leaf/15" strokeWidth={1.6} />
        <LpIcon name="leaf" className="absolute -left-8 bottom-10 h-32 w-32 -rotate-45 text-fd-leaf/10" strokeWidth={1.6} />
        <div className="relative mx-auto max-w-6xl px-5 pb-10 pt-5 md:px-10 md:pb-20 md:pt-8">
          <div className="mb-6 flex items-center justify-between md:mb-10">
            <span className="font-display text-2xl font-bold text-fd-leaf-dark">{asText(s.brand) || brand}</span>
            <button type="button" onClick={() => scrollTo('order')} className="py-2 text-sm font-medium text-fd-leaf-dark underline underline-offset-4">
              অর্ডার করুন
            </button>
          </div>
          <div className="grid items-center gap-8 md:grid-cols-2 md:gap-14">
            <div className="relative">
              <Pic src={image} alt={product?.name ?? ''} eager className="aspect-square w-full rounded-[2.5rem] border-4 border-white bg-fd-honey-light object-cover shadow-xl" />
              {asText(s.badge) ? (
                <span className="absolute -bottom-4 left-4 flex items-center gap-2 rounded-full bg-fd-leaf px-4 py-2 font-display font-semibold text-white shadow-lg">
                  <LpIcon name="shield" className="h-5 w-5" strokeWidth={1.6} />
                  {asText(s.badge)}
                </span>
              ) : null}
            </div>
            <div className="text-center md:text-left">
              {asText(s.eyebrow) ? <p className={EYEBROW}>{asText(s.eyebrow)}</p> : null}
              <h1 className="mt-2 font-display text-4xl font-bold leading-[1.15] text-fd-bark sm:text-5xl md:text-6xl">
                {asText(s.title)} {asText(s.titleHighlight) ? <span className="text-fd-honey-dark">{asText(s.titleHighlight)}</span> : null}
              </h1>
              {asText(s.subtitle) ? <p className="mt-4 text-lg text-fd-ink/80 md:text-xl">{asText(s.subtitle)}</p> : null}
              {product ? (
                <p className="mt-5 flex items-baseline justify-center gap-3 md:justify-start">
                  <span className="font-display text-5xl font-bold text-fd-leaf-dark">{money(price, currency)}</span>
                  {compareAt && compareAt > price ? <span className="text-xl text-fd-ink/50 line-through">{money(compareAt, currency)}</span> : null}
                  {variantName ? <span className="text-fd-ink/70">{variantName}</span> : null}
                </p>
              ) : null}
              <ul className="mt-5 flex flex-wrap justify-center gap-2 md:justify-start">
                {asItems(s.chips).map((chip, i) => (
                  <li key={i} className="flex items-center gap-2 rounded-full border border-fd-line bg-white/80 py-1.5 pl-2 pr-4 text-sm font-medium text-fd-leaf-dark">
                    <LpIcon name={itemText(chip, 'icon')} className="h-5 w-5" strokeWidth={1.6} />
                    {itemText(chip, 'text')}
                  </li>
                ))}
              </ul>
              {asText(s.buttonLabel) ? (
                <button type="button" data-hero-cta="" onClick={() => scrollTo('order')} className={`${HONEY_BTN} mt-7 h-14 w-full px-10 text-xl md:w-auto`}>
                  {asText(s.buttonLabel)}
                </button>
              ) : null}
              {s.showCountdown !== false ? <Timer label={asText(s.countdownLabel)} /> : null}
            </div>
          </div>
        </div>
      </section>
      <div className="bg-fd-honey-soft text-fd-cream">
        <svg viewBox="0 0 1440 40" preserveAspectRatio="none" className="block h-6 w-full md:h-10" aria-hidden="true">
          <path fill="currentColor" d="M0 40V18C120 2 240 2 360 14s240 24 360 12 240-26 360-14 240 18 360 8v16z" />
        </svg>
      </div>
    </>
  );
}

function Problem({ s }: { s: S }) {
  return (
    <section data-section="problem" className="px-5 py-14 md:px-10 md:py-24">
      <Reveal className="mx-auto max-w-3xl text-center">
        {asText(s.eyebrow) ? <p className={EYEBROW}>{asText(s.eyebrow)}</p> : null}
        <h2 className={H2}>{asText(s.title)}</h2>
        <div className="mt-8 grid gap-4 text-left">
          {asItems(s.items).map((item, i) => (
            <div key={i} className="flex gap-4 rounded-3xl border border-fd-line bg-white p-5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-fd-berry/10 font-display text-xl font-bold text-fd-berry">✕</span>
              <div>
                <h3 className="font-display text-xl font-semibold text-fd-bark">{itemText(item, 'title')}</h3>
                <p className="mt-0.5 text-fd-ink/75">{itemText(item, 'text')}</p>
              </div>
            </div>
          ))}
        </div>
        {asText(s.closing) ? <p className="mt-8 text-lg font-medium text-fd-leaf-dark">{asText(s.closing)}</p> : null}
      </Reveal>
    </section>
  );
}

function Benefits({ s }: { s: S }) {
  return (
    <section data-section="benefits" className="rounded-[2.5rem] bg-fd-leaf-light px-5 py-14 md:rounded-[4rem] md:px-10 md:py-24">
      <div className="mx-auto max-w-6xl">
        <Reveal className="mx-auto max-w-2xl text-center">
          {asText(s.eyebrow) ? <p className={EYEBROW}>{asText(s.eyebrow)}</p> : null}
          <h2 className={H2}>{asText(s.title)}</h2>
        </Reveal>
        <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {asItems(s.items).map((item, i) => (
            <Reveal key={i} className="rounded-3xl border border-white bg-white p-6 shadow-sm">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-fd-honey-soft text-fd-honey-dark">
                <LpIcon name={itemText(item, 'icon')} className="h-7 w-7" strokeWidth={1.6} />
              </span>
              <h3 className="mt-4 font-display text-2xl font-semibold text-fd-bark">{itemText(item, 'title')}</h3>
              <p className="mt-1 text-fd-ink/75">{itemText(item, 'text')}</p>
            </Reveal>
          ))}
        </div>
        {asText(s.note) ? <p className="mx-auto mt-8 max-w-xl text-center text-sm text-fd-ink/60">{asText(s.note)}</p> : null}
      </div>
    </section>
  );
}

function Source({ s }: { s: S }) {
  return (
    <section data-section="source" className="px-5 py-14 md:px-10 md:py-24">
      <div className="mx-auto max-w-6xl">
        <Reveal className="mx-auto max-w-2xl text-center">
          {asText(s.eyebrow) ? <p className={EYEBROW}>{asText(s.eyebrow)}</p> : null}
          <h2 className={H2}>{asText(s.title)}</h2>
        </Reveal>
        <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {asItems(s.steps).map((step, i) => (
            <Reveal key={i} as="li" className="relative">
              <Pic src={itemText(step, 'imageUrl')} alt={itemText(step, 'title')} className="aspect-[4/3] w-full rounded-3xl bg-fd-honey-soft object-cover" />
              <span className="absolute left-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-fd-leaf font-display font-bold text-white">{toBn(String(i + 1).padStart(2, '0'))}</span>
              <h3 className="mt-4 font-display text-2xl font-semibold text-fd-bark">{itemText(step, 'title')}</h3>
              <p className="mt-1 text-fd-ink/75">{itemText(step, 'text')}</p>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}

function PurityProof({ s }: { s: S }) {
  const { scrollTo } = useLanding();
  const images = asItems(s.images).filter((i) => itemText(i, 'imageUrl'));
  return (
    <section data-section="purity_proof" className="rounded-[2.5rem] bg-fd-leaf-dark px-5 py-14 text-fd-cream md:rounded-[4rem] md:px-10 md:py-24">
      <div className="mx-auto grid max-w-6xl items-center gap-10 md:grid-cols-2">
        <Reveal>
          {asText(s.eyebrow) ? <p className="font-display text-sm font-semibold tracking-wide text-fd-honey-light">{asText(s.eyebrow)}</p> : null}
          <h2 className="mt-2 font-display text-3xl font-bold leading-tight md:text-5xl">{asText(s.title)}</h2>
          {asText(s.text) ? <p className="mt-4 text-lg text-fd-cream/85">{asText(s.text)}</p> : null}
          <ul className="mt-6 space-y-3">
            {asItems(s.points).map((point, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-fd-honey text-fd-bark">
                  <LpIcon name="check" className="h-4 w-4" />
                </span>
                <span>{itemText(point, 'text')}</span>
              </li>
            ))}
          </ul>
          {asText(s.buttonLabel) ? (
            <button type="button" onClick={() => scrollTo('order')} className="mt-8 h-12 rounded-full bg-fd-honey px-8 font-display text-lg font-semibold text-fd-bark transition-colors hover:bg-fd-honey-light">
              {asText(s.buttonLabel)}
            </button>
          ) : null}
        </Reveal>
        {images.length > 0 ? (
          <Reveal className="grid grid-cols-2 gap-4">
            {images.map((img, i) => (
              <figure key={i} className={i === 0 ? 'col-span-2' : ''}>
                <Pic src={itemText(img, 'imageUrl')} alt={itemText(img, 'caption')} className={`w-full rounded-3xl bg-fd-cream object-cover ${i === 0 ? '' : 'aspect-square'}`} />
                {itemText(img, 'caption') ? <figcaption className="mt-2 text-center text-sm text-fd-cream/75">{itemText(img, 'caption')}</figcaption> : null}
              </figure>
            ))}
          </Reveal>
        ) : null}
      </div>
    </section>
  );
}

function Packages({ s }: { s: S }) {
  const { products, lines, setOnlyLine, scrollTo, currency } = useLanding();
  const product = products[0];
  const packages = packagesOf(product);
  const cards = asItems(s.cards);
  const selected = lines[0]?.variantId ?? null;
  if (!product) return null;
  return (
    <section data-section="packages" className="px-5 py-14 md:px-10 md:py-24">
      <div className="mx-auto max-w-5xl">
        <Reveal className="mx-auto max-w-2xl text-center">
          {asText(s.eyebrow) ? <p className={EYEBROW}>{asText(s.eyebrow)}</p> : null}
          <h2 className={H2}>{asText(s.title)}</h2>
          <Timer label={asText(s.countdownLabel)} />
        </Reveal>
        <div className="mt-12 grid gap-8 md:grid-cols-3 md:gap-6">
          {packages.map((pkg, i) => {
            const card = cards[i];
            const badge = card ? itemText(card, 'badge') : '';
            const save = pkg.compareAt && pkg.compareAt > pkg.price ? pkg.compareAt - pkg.price : 0;
            const featured = !!badge;
            const chosen = selected === pkg.id && lines.length > 0;
            return (
              <Reveal
                key={pkg.id ?? 'single'}
                className={`relative rounded-3xl border-2 bg-white p-6 pt-8 text-center transition-shadow ${featured ? 'border-fd-honey' : 'border-fd-line'} ${chosen ? 'shadow-xl ring-2 ring-fd-leaf' : ''}`}
              >
                {badge ? <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-fd-honey px-4 py-1 font-display text-sm font-semibold text-fd-bark">{badge}</span> : null}
                <Pic src={product.imageUrl ?? ''} alt={pkg.name} className="mx-auto h-36 w-36 rounded-full bg-fd-honey-soft object-cover" />
                <h3 className="mt-4 font-display text-3xl font-bold text-fd-bark">{pkg.name}</h3>
                {card && itemText(card, 'description') ? <p className="mt-1 text-sm text-fd-ink/70">{itemText(card, 'description')}</p> : null}
                <p className="mt-4 flex items-baseline justify-center gap-2">
                  <span className="font-display text-4xl font-bold text-fd-leaf-dark">{money(pkg.price, currency)}</span>
                  {save > 0 ? <span className="text-fd-ink/50 line-through">{money(pkg.compareAt!, currency)}</span> : null}
                </p>
                {save > 0 ? <p className="mt-1 inline-block rounded-full bg-fd-leaf-light px-3 py-0.5 text-sm font-medium text-fd-leaf-dark">সাশ্রয় {money(save, currency)}</p> : null}
                <button
                  type="button"
                  disabled={!pkg.available}
                  onClick={() => {
                    setOnlyLine(product.id, pkg.id, lines[0]?.quantity ?? 1);
                    scrollTo('order');
                  }}
                  className={`mt-5 h-12 w-full rounded-full font-display text-lg font-semibold transition-colors disabled:opacity-40 ${featured ? 'bg-fd-honey text-fd-bark hover:bg-fd-honey-light' : 'bg-fd-leaf text-white hover:bg-fd-leaf-dark'}`}
                >
                  {pkg.available ? asText(s.buttonLabel) || 'এটি অর্ডার করুন' : 'স্টক শেষ'}
                </button>
              </Reveal>
            );
          })}
        </div>
        {asText(s.note) ? <p className="mt-8 text-center text-fd-ink/70">{asText(s.note)}</p> : null}
      </div>
    </section>
  );
}

function Usage({ s }: { s: S }) {
  return (
    <section data-section="usage" className="rounded-[2.5rem] bg-fd-honey-soft px-5 py-14 md:rounded-[4rem] md:px-10 md:py-24">
      <div className="mx-auto max-w-6xl">
        <Reveal className="mx-auto max-w-2xl text-center">
          {asText(s.eyebrow) ? <p className={EYEBROW}>{asText(s.eyebrow)}</p> : null}
          <h2 className={H2}>{asText(s.title)}</h2>
        </Reveal>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {asItems(s.items).map((item, i) => (
            <Reveal key={i} className="overflow-hidden rounded-3xl border border-fd-line bg-white">
              <Pic src={itemText(item, 'imageUrl')} alt={itemText(item, 'title')} className="aspect-[3/2] w-full bg-fd-honey-soft object-cover" />
              <div className="p-5">
                <h3 className="font-display text-xl font-semibold text-fd-bark">{itemText(item, 'title')}</h3>
                <p className="mt-1 text-fd-ink/75">{itemText(item, 'text')}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Reviews({ s }: { s: S }) {
  const shots = asItems(s.screenshots).filter((i) => itemText(i, 'imageUrl'));
  return (
    <section data-section="reviews" className="px-5 py-14 md:px-10 md:py-24">
      <div className="mx-auto max-w-6xl">
        <Reveal className="mx-auto max-w-2xl text-center">
          {asText(s.eyebrow) ? <p className={EYEBROW}>{asText(s.eyebrow)}</p> : null}
          <h2 className={H2}>{asText(s.title)}</h2>
        </Reveal>
        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          {asItems(s.items).map((review, i) => (
            <Reveal key={i} as="figure" className="rounded-3xl border border-fd-line bg-white p-6">
              <span className="text-fd-honey">
                <Stars rating={Number(review.rating)} />
              </span>
              <blockquote className="mt-3 text-lg leading-relaxed">“{itemText(review, 'text')}”</blockquote>
              <figcaption className="mt-4 flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-fd-leaf-light font-display font-bold text-fd-leaf-dark">{initialsOf(itemText(review, 'name')).slice(0, 1)}</span>
                <span>
                  <span className="block font-semibold leading-tight">{itemText(review, 'name')}</span>
                  <span className="text-sm text-fd-ink/60">{[itemText(review, 'location'), 'যাচাইকৃত ক্রেতা'].filter(Boolean).join(' · ')}</span>
                </span>
              </figcaption>
            </Reveal>
          ))}
        </div>
        {shots.length > 0 ? (
          <Reveal className="mx-auto mt-8 grid max-w-3xl grid-cols-3 gap-3 md:gap-5">
            {shots.map((shot, i) => (
              <Pic key={i} src={itemText(shot, 'imageUrl')} alt={`গ্রাহকের রিভিউ স্ক্রিনশট ${i + 1}`} className="aspect-[9/16] w-full rounded-2xl border border-fd-line bg-fd-honey-soft object-cover" />
            ))}
          </Reveal>
        ) : null}
      </div>
    </section>
  );
}

function Guarantee({ s }: { s: S }) {
  return (
    <section data-section="guarantee" className="rounded-[2.5rem] bg-fd-leaf-light px-5 py-14 md:rounded-[4rem] md:px-10 md:py-24">
      <div className="mx-auto max-w-5xl">
        <Reveal className="mx-auto max-w-2xl text-center">
          {asText(s.eyebrow) ? <p className={EYEBROW}>{asText(s.eyebrow)}</p> : null}
          <h2 className={H2}>{asText(s.title)}</h2>
        </Reveal>
        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          {asItems(s.items).map((item, i) => (
            <Reveal key={i} className="flex gap-4 rounded-3xl bg-white p-6">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-fd-leaf text-white">
                <LpIcon name={itemText(item, 'icon')} className="h-7 w-7" strokeWidth={1.6} />
              </span>
              <div>
                <h3 className="font-display text-2xl font-semibold text-fd-bark">{itemText(item, 'title')}</h3>
                <p className="mt-1 text-fd-ink/75">{itemText(item, 'text')}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Faq({ s }: { s: S }) {
  return (
    <section data-section="faq" className="px-5 py-14 md:px-10 md:py-24">
      <div className="mx-auto max-w-3xl">
        <Reveal className="text-center">
          {asText(s.eyebrow) ? <p className={EYEBROW}>{asText(s.eyebrow)}</p> : null}
          <h2 className={H2}>{asText(s.title)}</h2>
        </Reveal>
        <div className="mt-10 space-y-3">
          <FaqList
            items={asItems(s.items)}
            skin={{
              item: 'rounded-3xl border border-fd-line bg-white',
              button: 'flex min-h-[60px] w-full items-center justify-between gap-4 px-5 py-4 text-left',
              question: 'font-display text-lg font-semibold leading-snug text-fd-bark',
              panel: 'px-5 pb-5 leading-relaxed text-fd-ink/80',
              chevron: 'h-5 w-5 text-fd-leaf',
            }}
          />
        </div>
      </div>
    </section>
  );
}

function PackagePicker() {
  const { products, lines, setOnlyLine, currency } = useLanding();
  const product = products[0];
  const packages = packagesOf(product);
  if (!product) return <p className="py-6 text-center text-fd-ink/70">এই অফারটি এখন পাওয়া যাচ্ছে না।</p>;
  const line = lines[0];
  return (
    <div className="space-y-6">
      {packages.length > 1 ? (
        <fieldset>
          <legend className="mb-1.5 block font-medium text-fd-bark">প্যাকেজ বাছুন</legend>
          <div className="grid grid-cols-3 gap-2.5">
            {packages.map((pkg) => (
              <label key={pkg.id ?? 'single'} className={`block ${pkg.available ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}>
                <input
                  type="radio"
                  name="lp-package"
                  className="peer sr-only"
                  disabled={!pkg.available}
                  checked={line?.variantId === pkg.id}
                  onChange={() => setOnlyLine(product.id, pkg.id, line?.quantity ?? 1)}
                />
                <span className="flex h-full flex-col rounded-2xl border-2 border-fd-line bg-white px-2 py-3 text-center transition peer-checked:border-fd-leaf peer-checked:bg-fd-leaf-light peer-focus-visible:ring-2 peer-focus-visible:ring-fd-honey">
                  <span className="font-display text-xl font-semibold leading-none text-fd-bark">{pkg.name}</span>
                  <span className="mt-1 font-semibold">{money(pkg.price, currency)}</span>
                  {pkg.compareAt && pkg.compareAt > pkg.price ? <span className="text-xs text-fd-ink/50 line-through">{money(pkg.compareAt, currency)}</span> : <span className="text-xs">&nbsp;</span>}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : (
        <p className="font-display text-xl font-semibold text-fd-bark">{product.name}</p>
      )}
      <div className="flex items-center justify-between gap-4">
        <span className="font-medium text-fd-bark">পরিমাণ</span>
        <QuantityStepper
          value={line?.quantity ?? 1}
          onChange={(next) => line && setOnlyLine(product.id, line.variantId, next)}
          skin={{
            box: 'flex h-12 items-center overflow-hidden rounded-full border-2 border-fd-line',
            button: 'h-full w-12 text-2xl text-fd-leaf-dark hover:bg-fd-leaf-light disabled:opacity-40 disabled:hover:bg-transparent',
            value: 'min-w-[44px] text-center font-display text-xl font-semibold',
          }}
        />
      </div>
    </div>
  );
}

function Order({ s }: { s: S }) {
  return (
    <section data-section="order" className="rounded-t-[2.5rem] bg-fd-leaf-dark px-5 py-14 md:rounded-t-[4rem] md:px-10 md:py-24">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 text-center text-fd-cream">
          {asText(s.eyebrow) ? <p className="font-display text-sm font-semibold tracking-wide text-fd-honey-light">{asText(s.eyebrow)}</p> : null}
          <h2 className="mt-2 font-display text-3xl font-bold md:text-5xl">{asText(s.title)}</h2>
          {asText(s.subtitle) ? <p className="mt-2 text-fd-cream/80">{asText(s.subtitle)}</p> : null}
        </div>
        <LandingOrderForm
          showSavings
          skin={ORDER_SKIN}
          texts={{ buttonLabel: asText(s.buttonLabel) || 'অর্ডার কনফার্ম করুন', note: asText(s.note), successText: asText(s.successText) }}
          products={<PackagePicker />}
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
    <footer data-section="footer" className="bg-fd-leaf-deep px-5 pb-28 pt-12 text-fd-cream md:px-10 md:pb-10">
      <div className="mx-auto grid max-w-6xl items-center gap-8 md:grid-cols-2">
        <div>
          <p className="font-display text-3xl font-bold">{brand}</p>
          {asText(s.text) ? <p className="mt-2 max-w-sm text-fd-cream/75">{asText(s.text)}</p> : null}
        </div>
        <div className="space-y-3 md:text-right">
          {phone ? (
            <a href={`tel:${phone.replace(/[^\d+]/g, '')}`} className="inline-flex min-h-[44px] items-center gap-2 text-lg">
              <LpIcon name="phone" className="h-5 w-5" strokeWidth={1.6} />
              {phone}
            </a>
          ) : null}
          {facebook ? (
            <div>
              <a href={facebook} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-fd-cream/30 px-4 transition-colors hover:bg-fd-cream hover:text-fd-leaf-deep">
                <LpIcon name="facebook" className="h-5 w-5" strokeWidth={1.6} />
                Facebook পেজ
              </a>
            </div>
          ) : null}
        </div>
      </div>
      <p className="mx-auto mt-10 max-w-6xl border-t border-fd-cream/15 pt-5 text-xs text-fd-cream/50">
        © {new Date().getFullYear()} {brand}। সর্বস্বত্ব সংরক্ষিত। {asText(s.disclaimer)}
      </p>
    </footer>
  );
}

function StickyBar() {
  const { products, lines, scrollTo, currency } = useLanding();
  const show = useStickyBar();
  const { price, variantName } = linePrice(products[0], lines[0]?.variantId ?? null);
  const quantity = lines[0]?.quantity ?? 1;
  return (
    <div
      aria-hidden={!show}
      className={`fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-3 border-t border-fd-line bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_20px_rgba(0,0,0,.08)] transition-transform duration-300 md:hidden ${show ? 'translate-y-0' : 'invisible translate-y-full'}`}
    >
      <div className="leading-tight">
        <div className="font-display text-2xl font-bold text-fd-leaf-dark">{money(price * quantity, currency)}</div>
        <div className="text-xs text-fd-ink/60">{[variantName, quantity > 1 ? `${toBn(quantity)}টি` : null].filter(Boolean).join(' · ')}</div>
      </div>
      <button type="button" tabIndex={show ? 0 : -1} onClick={() => scrollTo('order')} className="h-12 rounded-full bg-fd-honey px-8 font-display text-lg font-semibold text-fd-bark">
        অর্ডার করুন
      </button>
    </div>
  );
}

const SECTIONS: Record<string, (props: { s: S }) => ReactNode> = {
  hero: Hero,
  problem: Problem,
  benefits: Benefits,
  source: Source,
  purity_proof: PurityProof,
  packages: Packages,
  usage: Usage,
  reviews: Reviews,
  guarantee: Guarantee,
  faq: Faq,
  order: Order,
  footer: Footer,
};

export function FoodTemplate() {
  const { content } = useLanding();
  return (
    <div className="lp-fd-paper bg-fd-cream font-sans text-fd-ink antialiased">
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

