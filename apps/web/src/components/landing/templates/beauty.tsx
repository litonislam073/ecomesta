'use client';

import { useState, type CSSProperties, type ReactNode } from 'react';
import type { LandingValue } from '@ecomesta/utils';
import { FaqList, LpIcon, Marked, Pic, Reveal, Stars, useStickyBar } from '../landing-bits';
import { asItems, asText, itemText, money, toBn, useLanding, type LandingProduct } from '../landing-context';
import { BeforeAfterSlider, TimerCells, useMainLine, type TimerSkin } from '../landing-kit';
import { LandingOrderForm, type OrderSkin } from '../landing-order-form';
import { QuantityStepper } from '../landing-pickers';

type S = Record<string, LandingValue>;

const WRAP = 'mx-auto w-full max-w-6xl px-5 md:px-10';
const EYEBROW = 'text-xs font-semibold uppercase tracking-[0.22em] text-bt-rose';
const H2 = 'mt-2 font-display text-3xl leading-tight text-bt-plum md:text-5xl';
const ROSE_BTN = 'inline-flex items-center justify-center rounded-full bg-bt-rose font-semibold text-white shadow-lg shadow-bt-rose/25 transition-colors hover:bg-bt-rose-dark focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-bt-rose/30';
const ROUND_SECTION = 'rounded-[2.5rem] md:rounded-[4rem]';

const TIMER: TimerSkin = {
  box: 'inline-flex items-center gap-2 text-center',
  cell: 'min-w-[56px] rounded-2xl border border-bt-line bg-white px-2 py-1.5',
  value: 'font-display text-2xl leading-none text-bt-rose-dark',
  label: 'text-[11px] text-bt-mute',
};

const ORDER_SKIN: OrderSkin = {
  form: 'rounded-[2rem] border border-bt-line bg-white p-5 shadow-xl shadow-bt-rose/5 md:p-9',
  label: 'mb-1.5 block pl-1 font-medium',
  input: 'h-12 w-full rounded-full border-2 border-bt-line bg-white px-5 text-base placeholder:text-bt-mute/60 focus:border-bt-rose focus:outline-none focus:ring-2 focus:ring-bt-rose/20',
  inputInvalid: 'border-bt-bad',
  select: 'h-12 w-full rounded-full border-2 border-bt-line bg-white px-4 text-base focus:border-bt-rose focus:outline-none focus:ring-2 focus:ring-bt-rose/20 disabled:opacity-60',
  error: 'mt-1 pl-1 text-sm text-bt-bad',
  choice: 'flex cursor-pointer items-center gap-3 rounded-3xl border-2 border-bt-line p-4 has-[:checked]:border-bt-rose has-[:checked]:bg-bt-blush-soft has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-bt-rose',
  choiceTitle: 'block font-medium',
  choiceHint: 'block text-sm text-bt-mute',
  choicePrice: 'font-semibold text-bt-rose-dark',
  radio: 'h-4 w-4 accent-[rgb(var(--bt-rose))]',
  summary: 'space-y-2 rounded-3xl bg-bt-blush-soft p-5',
  summaryLabel: 'text-bt-mute',
  summaryValue: '',
  totalLabel: 'font-semibold',
  totalValue: 'font-display text-3xl text-bt-rose-dark',
  divider: 'mt-3 border-t border-bt-blush pt-1',
  savingValue: 'font-semibold text-bt-good',
  formError: 'mb-3 text-center text-sm text-bt-bad',
  button: `${ROSE_BTN} h-14 w-full text-lg disabled:opacity-60`,
  note: 'mt-3 text-center text-sm text-bt-mute',
  success: {
    box: 'rounded-[2rem] border-2 border-bt-good bg-white p-8 text-center focus:outline-none',
    icon: 'mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-bt-good text-white',
    title: 'mt-4 font-display text-4xl',
    text: 'mt-3 text-lg',
    total: 'mt-2 font-semibold text-bt-rose-dark',
    link: 'mt-6 inline-flex h-11 items-center rounded-full border-2 border-bt-rose px-6 font-semibold text-bt-rose hover:bg-bt-rose-light',
  },
};

/** The ingredient drawings (the design's soft illustrations). */
function Art({ name, label }: { name: string; label: string }) {
  const common = { viewBox: '0 0 64 64', className: 'mx-auto h-20 w-20', role: 'img', 'aria-label': label } as const;
  switch (name) {
    case 'drop':
      return (
        <svg {...common}>
          <path d="M32 8c10 12 16 20 16 29a16 16 0 01-32 0c0-9 6-17 16-29z" fill="#DDEBF7" stroke="#7AA9D1" strokeWidth="2.5" />
          <path d="M24 38a8 8 0 008 8" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
          <circle cx="49" cy="17" r="3" fill="#BFD9EE" />
          <circle cx="14" cy="22" r="2" fill="#BFD9EE" />
        </svg>
      );
    case 'leaf':
      return (
        <svg {...common}>
          <path d="M10 52C10 28 26 12 54 10c0 28-16 44-40 44" fill="#CFE6D0" stroke="#6FA477" strokeWidth="2.5" />
          <path d="M10 54c10-16 20-26 34-36" fill="none" stroke="#6FA477" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      );
    case 'flower':
      return (
        <svg {...common}>
          <g fill="#F7CAD4" stroke="#D77A94" strokeWidth="2">
            <circle cx="32" cy="16" r="9" />
            <circle cx="47" cy="27" r="9" />
            <circle cx="41" cy="45" r="9" />
            <circle cx="23" cy="45" r="9" />
            <circle cx="17" cy="27" r="9" />
          </g>
          <circle cx="32" cy="32" r="8" fill="#FBE3A8" stroke="#E0B552" strokeWidth="2" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="32" cy="34" r="22" fill="#FBD9C9" stroke="#E98A5C" strokeWidth="2.5" />
          <circle cx="32" cy="34" r="17" fill="#FFC9A8" />
          <path d="M32 17v34M15 34h34M20 22l24 24M44 22L20 46" stroke="#FFF2E8" strokeWidth="2" />
          <path d="M34 12c4-6 10-6 13-4-3 5-8 6-13 4z" fill="#7BAE7F" />
        </svg>
      );
  }
}

/** The product's packages: its variants, or the product itself. */
function packagesOf(product: LandingProduct | undefined) {
  if (!product) return [];
  if (product.variants.length === 0) return [{ id: null as string | null, name: product.name, price: product.price, compareAt: product.compareAt, available: product.available }];
  return product.variants.map((v) => ({ id: v.id as string | null, name: v.name, price: v.price, compareAt: v.compareAt, available: v.available }));
}

function ScrollButton({ label, className = '', hero }: { label: string; className?: string; hero?: boolean }) {
  const { scrollTo } = useLanding();
  if (!label) return null;
  return (
    <button type="button" data-hero-cta={hero ? '' : undefined} onClick={() => scrollTo('order')} className={`${ROSE_BTN} h-14 px-12 text-lg ${className}`}>
      {label}
    </button>
  );
}

function Header({ eyebrow, title, subtitle, center = true }: { eyebrow: string; title: string; subtitle?: string; center?: boolean }) {
  return (
    <Reveal className={center ? 'mx-auto max-w-2xl text-center' : 'max-w-2xl'}>
      {eyebrow ? <p className={EYEBROW}>{eyebrow}</p> : null}
      <h2 className={H2}>{title}</h2>
      {subtitle ? <p className="mt-3 text-bt-mute">{subtitle}</p> : null}
    </Reveal>
  );
}

function Hero({ s }: { s: S }) {
  const { brand, scrollTo, countdownEnd, currency } = useLanding();
  const { product, price, compareAt, variantName } = useMainLine();
  const image = asText(s.imageUrl) || product?.imageUrl || '';
  return (
    <section data-section="hero" className="relative overflow-hidden bg-gradient-to-b from-bt-blush-soft via-bt-peach-soft to-bt-cream">
      <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-bt-blush/60 blur-3xl" aria-hidden="true" />
      <div className="absolute -left-24 top-72 h-64 w-64 rounded-full bg-bt-peach/70 blur-3xl" aria-hidden="true" />
      <div className={`relative ${WRAP}`}>
        <div className="flex items-center justify-between py-5">
          <span className="font-display text-2xl text-bt-rose-dark">{asText(s.brand) || brand}</span>
          <button type="button" onClick={() => scrollTo('order')} className="py-2 text-sm font-semibold text-bt-rose">
            অর্ডার করুন
          </button>
        </div>
        <div className="grid items-center gap-8 pb-14 md:grid-cols-2 md:gap-14 md:pb-24 md:pt-4">
          <div className="relative">
            <Pic src={image} alt={product?.name ?? ''} eager className="mx-auto aspect-[4/5] w-full max-w-sm rounded-b-[2rem] rounded-t-[999px] border-[6px] border-white bg-bt-blush object-cover shadow-2xl shadow-bt-rose/20" />
            {asText(s.imageTag) ? (
              <span className="absolute -left-1 bottom-6 rounded-full bg-white px-4 py-2 text-sm font-semibold text-bt-rose-dark shadow-lg md:left-4">{asText(s.imageTag)}</span>
            ) : null}
          </div>
          <div className="text-center md:text-left">
            {asText(s.eyebrow) ? <p className={EYEBROW}>{asText(s.eyebrow)}</p> : null}
            <h1 className="mt-3 font-display text-5xl leading-[1.1] md:text-6xl">
              {asText(s.title)}
              {asText(s.titleHighlight) ? <span className="text-bt-rose">{asText(s.titleHighlight)}</span> : null}
              {asText(s.titleSub) ? (
                <>
                  <br />
                  <span className="text-3xl md:text-4xl">{asText(s.titleSub)}</span>
                </>
              ) : null}
            </h1>
            {asText(s.subtitle) ? (
              <p className="mt-4 text-xl">
                <Marked text={asText(s.subtitle)} markClass="bg-transparent font-semibold text-bt-rose-dark" />
              </p>
            ) : null}
            {product ? (
              <p className="mt-5 flex flex-wrap items-baseline justify-center gap-3 md:justify-start">
                <span className="font-display text-5xl text-bt-rose-dark">{money(price, currency)}</span>
                {compareAt && compareAt > price ? <span className="text-xl text-bt-mute line-through">{money(compareAt, currency)}</span> : null}
                {variantName ? <span className="text-sm text-bt-mute">{variantName}</span> : null}
              </p>
            ) : null}
            <ul className="mt-5 flex flex-wrap justify-center gap-2 text-sm md:justify-start">
              {asItems(s.badges).map((badge, i) => (
                <li key={i} className="inline-flex items-center gap-1.5 rounded-full border border-bt-line bg-white/80 py-1.5 pl-2.5 pr-3.5 font-medium">
                  <LpIcon name={itemText(badge, 'icon')} className="h-4 w-4 text-bt-rose" strokeWidth={1.5} />
                  {itemText(badge, 'text')}
                </li>
              ))}
            </ul>
            <ScrollButton label={asText(s.buttonLabel)} hero className="mt-7 w-full md:w-auto" />
            {asText(s.note) ? <p className="mt-3 text-sm text-bt-mute">{asText(s.note)}</p> : null}
            {countdownEnd !== null ? (
              <div className="mt-5">
                {asText(s.countdownLabel) ? <p className="mb-2 text-xs text-bt-mute">{asText(s.countdownLabel)}</p> : null}
                <TimerCells skin={TIMER} />
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function Concerns({ s }: { s: S }) {
  return (
    <section data-section="concerns" className="py-14 md:py-20">
      <div className={WRAP}>
        <Header eyebrow={asText(s.eyebrow)} title={asText(s.title)} />
        <ul className="mt-8 flex flex-wrap justify-center gap-3">
          {asItems(s.items).map((item, i) => (
            <Reveal as="li" key={i} className="inline-flex items-center gap-2.5 rounded-full border border-bt-line bg-white py-2.5 pl-3 pr-5 shadow-sm">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-bt-blush-soft text-bt-rose">
                <LpIcon name={itemText(item, 'icon')} className="h-5 w-5" strokeWidth={1.5} />
              </span>
              <span className="font-medium">{itemText(item, 'text')}</span>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Ingredients({ s }: { s: S }) {
  return (
    <section data-section="ingredients" className={`bg-bt-blush-soft py-14 md:py-24 ${ROUND_SECTION}`}>
      <div className={WRAP}>
        <Header eyebrow={asText(s.eyebrow)} title={asText(s.title)} subtitle={asText(s.subtitle)} />
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {asItems(s.items).map((item, i) => (
            <Reveal key={i} className="rounded-[2rem] border border-white bg-white p-6 text-center">
              {itemText(item, 'imageUrl') ? (
                <Pic src={itemText(item, 'imageUrl')} alt={itemText(item, 'name')} className="mx-auto h-20 w-20 rounded-full object-cover" />
              ) : (
                <Art name={itemText(item, 'art')} label={itemText(item, 'name')} />
              )}
              <h3 className="mt-4 font-display text-xl leading-snug">{itemText(item, 'name')}</h3>
              <p className="mt-2 text-sm leading-relaxed text-bt-mute md:text-base">{itemText(item, 'text')}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function SkinTypes({ s }: { s: S }) {
  const items = asItems(s.items);
  const [active, setActive] = useState(0);
  const current = items[Math.min(active, items.length - 1)];
  return (
    <section data-section="skin_types" className="py-14 md:py-24">
      <div className={WRAP}>
        <div className="mx-auto max-w-3xl">
          <Header eyebrow={asText(s.eyebrow)} title={asText(s.title)} />
          <Reveal className="mt-8">
            <div role="tablist" aria-label="ত্বকের ধরন" className="flex flex-wrap justify-center gap-2">
              {items.map((item, i) => (
                <button
                  key={i}
                  type="button"
                  role="tab"
                  aria-selected={i === active}
                  onClick={() => setActive(i)}
                  className={`h-11 rounded-full border border-bt-line px-5 text-sm font-medium transition-colors md:text-base ${i === active ? 'bg-bt-rose text-white' : 'bg-white text-bt-plum'}`}
                >
                  {itemText(item, 'name')}
                </button>
              ))}
            </div>
            {current ? (
              <div role="tabpanel" className="mt-6 rounded-[2rem] border border-bt-line bg-white p-6 md:p-8">
                <div className="flex items-start gap-4">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-bt-blush-soft text-bt-rose">
                    <LpIcon name="heart" className="h-6 w-6" strokeWidth={1.5} />
                  </span>
                  <div>
                    <h3 className="font-display text-2xl">{itemText(current, 'title')}</h3>
                    <p className="mt-2 text-base leading-relaxed text-bt-mute md:text-lg">{itemText(current, 'text')}</p>
                  </div>
                </div>
              </div>
            ) : null}
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function HowToUse({ s }: { s: S }) {
  return (
    <section data-section="how_to_use" className={`bg-bt-peach-soft py-14 md:py-24 ${ROUND_SECTION}`}>
      <div className={WRAP}>
        <Header eyebrow={asText(s.eyebrow)} title={asText(s.title)} />
        <ol className="mt-10 grid gap-6 md:grid-cols-3">
          {asItems(s.items).map((item, i) => (
            <Reveal as="li" key={i} className="overflow-hidden rounded-[2rem] border border-white bg-white">
              <Pic src={itemText(item, 'imageUrl')} alt={itemText(item, 'title')} className="aspect-[4/3] w-full object-cover" />
              <div className="p-6">
                <p className="font-display text-3xl leading-none text-bt-rose">{String(i + 1).padStart(2, '0')}</p>
                <h3 className="mt-2 font-display text-2xl">{itemText(item, 'title')}</h3>
                <p className="mt-2 leading-relaxed text-bt-mute">{itemText(item, 'text')}</p>
              </div>
            </Reveal>
          ))}
        </ol>
        {asText(s.note) ? <p className="mt-6 text-center text-sm text-bt-mute">{asText(s.note)}</p> : null}
      </div>
    </section>
  );
}

function BeforeAfter({ s }: { s: S }) {
  const items = asItems(s.items).filter((i) => itemText(i, 'beforeUrl') && itemText(i, 'afterUrl'));
  return (
    <section data-section="before_after" className="py-14 md:py-24" style={{ '--ba-accent': 'rgb(var(--bt-rose))' } as CSSProperties}>
      <div className={WRAP}>
        <Header eyebrow={asText(s.eyebrow)} title={asText(s.title)} />
        {asText(s.hint) ? <p className="mt-3 text-center text-sm text-bt-mute">{asText(s.hint)}</p> : null}
        <div className="mx-auto mt-10 grid max-w-5xl gap-6 md:grid-cols-3">
          {items.map((item, i) => (
            <BeforeAfterSlider
              key={i}
              before={itemText(item, 'beforeUrl')}
              after={itemText(item, 'afterUrl')}
              caption={itemText(item, 'caption')}
              afterLabel={itemText(item, 'label') || 'পরে'}
              boxClass="rounded-[2rem] border border-bt-line bg-bt-blush-soft"
              imageClass="aspect-[7/8]"
              beforeTagClass="rounded-full bg-bt-plum/80 px-3 py-1 text-xs font-semibold text-white"
              afterTagClass="rounded-full bg-bt-rose px-3 py-1 text-xs font-semibold text-white"
              captionClass="mt-3 text-center text-sm font-semibold text-bt-plum"
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function Results({ s }: { s: S }) {
  return (
    <section data-section="results" className={`bg-bt-rose py-14 text-white md:py-24 ${ROUND_SECTION}`}>
      <div className={WRAP}>
        <Reveal className="mx-auto max-w-2xl text-center">
          {asText(s.eyebrow) ? <p className="text-xs font-semibold uppercase tracking-[0.22em] text-bt-blush">{asText(s.eyebrow)}</p> : null}
          <h2 className="mt-2 font-display text-3xl leading-tight md:text-5xl">{asText(s.title)}</h2>
        </Reveal>
        <div className="mt-10 grid grid-cols-2 gap-4 md:gap-6 lg:grid-cols-4">
          {asItems(s.items).map((item, i) => (
            <Reveal key={i} className="rounded-[2rem] border border-white/20 bg-white/10 p-5 text-center md:p-7">
              <p className="font-display text-5xl leading-none md:text-6xl">{itemText(item, 'value')}</p>
              <p className="mt-3 text-sm leading-snug text-white/90 md:text-base">{itemText(item, 'text')}</p>
            </Reveal>
          ))}
        </div>
        {asText(s.note) ? <p className="mt-6 text-center text-xs text-white/75">{asText(s.note)}</p> : null}
      </div>
    </section>
  );
}

function Reviews({ s }: { s: S }) {
  return (
    <section data-section="reviews" className="py-14 md:py-24">
      <div className={WRAP}>
        <Header eyebrow={asText(s.eyebrow)} title={asText(s.title)} center={false} />
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {asItems(s.items).map((review, i) => (
            <Reveal as="figure" key={i} className="flex flex-col overflow-hidden rounded-[2rem] border border-bt-line bg-white">
              {itemText(review, 'imageUrl') ? <Pic src={itemText(review, 'imageUrl')} alt={`${itemText(review, 'name')}-এর ছবি`} className="aspect-[8/7] w-full object-cover" /> : null}
              <div className="flex-1 p-5">
                {itemText(review, 'tag') ? <span className="inline-block rounded-full bg-bt-blush-soft px-3 py-1 text-xs font-semibold text-bt-rose-dark">{itemText(review, 'tag')}</span> : null}
                <div className="mt-3 text-bt-star">
                  <Stars rating={Number(review.rating)} className="h-4 w-4" />
                </div>
                <blockquote className="mt-2 text-sm leading-relaxed md:text-base">“{itemText(review, 'text')}”</blockquote>
                <figcaption className="mt-3 text-sm text-bt-mute">
                  <b className="text-bt-plum">{itemText(review, 'name')}</b>
                  {itemText(review, 'location') ? `, ${itemText(review, 'location')}` : ''} · যাচাইকৃত ক্রেতা
                </figcaption>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Authenticity({ s }: { s: S }) {
  return (
    <section data-section="authenticity" className={`bg-bt-blush-soft py-14 md:py-24 ${ROUND_SECTION}`}>
      <div className={WRAP}>
        <div className="grid items-center gap-10 md:grid-cols-2">
          <Reveal>
            <div className="mx-auto flex h-40 w-40 items-center justify-center rounded-full border-4 border-dashed border-bt-rose bg-white md:mx-0" role="img" aria-label={`${asText(s.sealValue)} ${asText(s.sealLabel)}`}>
              <div className="text-center leading-none text-bt-rose-dark">
                <p className="font-display text-4xl">{asText(s.sealValue)}</p>
                <p className="mt-1 text-sm font-semibold">{asText(s.sealLabel)}</p>
              </div>
            </div>
            <h2 className={`${H2} mt-6 text-center md:text-left`}>{asText(s.title)}</h2>
            {asText(s.text) ? <p className="mt-3 text-center text-bt-mute md:text-left">{asText(s.text)}</p> : null}
            {asText(s.imageUrl) ? <Pic src={asText(s.imageUrl)} alt="" className="mt-6 aspect-[5/3] w-full rounded-[2rem] border border-bt-line object-cover" /> : null}
          </Reveal>
          <ul className="grid gap-4">
            {asItems(s.items).map((item, i) => (
              <Reveal as="li" key={i} className="flex gap-4 rounded-[2rem] border border-white bg-white p-5">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-bt-rose text-white">
                  <LpIcon name={itemText(item, 'icon')} className="h-6 w-6" strokeWidth={1.5} />
                </span>
                <div>
                  <h3 className="font-display text-xl">{itemText(item, 'title')}</h3>
                  <p className="mt-0.5 text-sm leading-snug text-bt-mute md:text-base">{itemText(item, 'text')}</p>
                </div>
              </Reveal>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function Packages({ s }: { s: S }) {
  const { products, lines, setOnlyLine, scrollTo, countdownEnd, currency } = useLanding();
  const product = products[0];
  const packages = packagesOf(product);
  const cards = asItems(s.cards);
  const selected = lines[0]?.variantId ?? null;
  // The first package with a tag is the one to recommend.
  const featuredIndex = cards.findIndex((c) => itemText(c, 'badge'));
  if (!product) return null;
  return (
    <section data-section="packages" className="py-14 md:py-24">
      <div className={WRAP}>
        <Reveal className="mx-auto max-w-2xl text-center">
          {asText(s.eyebrow) ? <p className={EYEBROW}>{asText(s.eyebrow)}</p> : null}
          <h2 className={H2}>{asText(s.title)}</h2>
          {countdownEnd !== null ? (
            <div className="mt-5">
              {asText(s.countdownLabel) ? <p className="mb-2 text-xs text-bt-mute">{asText(s.countdownLabel)}</p> : null}
              <TimerCells skin={TIMER} />
            </div>
          ) : null}
        </Reveal>
        <div className="mx-auto mt-12 grid max-w-5xl gap-8 md:grid-cols-3 md:gap-6">
          {packages.map((pkg, i) => {
            const card = cards[i];
            const badge = card ? itemText(card, 'badge') : '';
            const featured = i === featuredIndex;
            const save = pkg.compareAt && pkg.compareAt > pkg.price ? pkg.compareAt - pkg.price : 0;
            const chosen = selected === pkg.id && lines.length > 0;
            return (
              <Reveal
                key={pkg.id ?? 'single'}
                className={`relative rounded-[2rem] border bg-white p-6 pt-8 text-center transition-shadow ${featured ? 'border-bt-rose shadow-xl shadow-bt-rose/10' : 'border-bt-line'} ${chosen ? 'ring-2 ring-bt-rose' : ''}`}
              >
                {badge ? (
                  <span className={`absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-semibold ${featured ? 'bg-bt-rose text-white' : 'bg-bt-peach text-bt-plum'}`}>{badge}</span>
                ) : null}
                <Pic src={(card && itemText(card, 'imageUrl')) || product.imageUrl || ''} alt={pkg.name} className="mx-auto h-36 w-36 rounded-full bg-bt-blush-soft object-cover" />
                <h3 className="mt-4 font-display text-2xl">{pkg.name}</h3>
                {card && itemText(card, 'description') ? <p className="mt-1 text-sm leading-snug text-bt-mute">{itemText(card, 'description')}</p> : null}
                <p className="mt-4 flex items-baseline justify-center gap-2">
                  <span className="font-display text-4xl text-bt-rose-dark">{money(pkg.price, currency)}</span>
                  {save > 0 ? <span className="text-bt-mute line-through">{money(pkg.compareAt!, currency)}</span> : null}
                </p>
                {save > 0 ? <p className="mt-1 inline-block rounded-full bg-bt-rose-light px-3 py-0.5 text-sm font-medium text-bt-rose-dark">সাশ্রয় {money(save, currency)}</p> : null}
                <button
                  type="button"
                  disabled={!pkg.available}
                  onClick={() => {
                    setOnlyLine(product.id, pkg.id, lines[0]?.quantity ?? 1);
                    scrollTo('order');
                  }}
                  className={`mt-5 h-12 w-full rounded-full font-semibold transition-colors disabled:opacity-40 ${featured ? `${ROSE_BTN}` : 'border-2 border-bt-rose text-bt-rose hover:bg-bt-rose-light'}`}
                >
                  {pkg.available ? asText(s.buttonLabel) || 'এটি বেছে নিন' : 'স্টক শেষ'}
                </button>
              </Reveal>
            );
          })}
        </div>
        {asText(s.note) ? <p className="mt-8 text-center text-bt-mute">{asText(s.note)}</p> : null}
      </div>
    </section>
  );
}

function Faq({ s }: { s: S }) {
  return (
    <section data-section="faq" className={`bg-bt-peach-soft py-14 md:py-24 ${ROUND_SECTION}`}>
      <div className={WRAP}>
        <div className="mx-auto max-w-3xl">
          <Header eyebrow={asText(s.eyebrow)} title={asText(s.title)} />
          <div className="mt-8 space-y-3">
            <FaqList
              items={asItems(s.items)}
              skin={{
                item: 'rounded-[1.5rem] border border-bt-line bg-white',
                button: 'flex min-h-[60px] w-full items-center justify-between gap-4 px-6 py-4 text-left',
                question: 'font-semibold leading-snug',
                panel: 'px-6 pb-5 leading-relaxed text-bt-mute',
                chevron: 'h-5 w-5 text-bt-rose',
              }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function PackagePicker() {
  const { currency } = useLanding();
  const { product, variantId, quantity, setVariant, setQuantity, line } = useMainLine();
  const packages = packagesOf(product);
  if (!product) return <p className="py-6 text-center text-bt-mute">এই অফারটি এখন পাওয়া যাচ্ছে না।</p>;
  return (
    <div className="space-y-6">
      {packages.length > 1 ? (
        <fieldset>
          <legend className="mb-1.5 block pl-1 font-medium">প্যাকেজ বাছুন</legend>
          <div className="grid grid-cols-3 gap-2.5">
            {packages.map((pkg) => (
              <label key={pkg.id ?? 'single'} className={`block ${pkg.available ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}>
                <input type="radio" name="lp-package" className="peer sr-only" disabled={!pkg.available} checked={variantId === pkg.id} onChange={() => setVariant(pkg.id)} />
                <span className="flex h-full flex-col rounded-3xl border-2 border-bt-line bg-white px-2 py-3 text-center transition peer-checked:border-bt-rose peer-checked:bg-bt-blush-soft peer-focus-visible:ring-2 peer-focus-visible:ring-bt-rose">
                  <span className="font-display text-lg leading-tight">{pkg.name}</span>
                  <span className="mt-1 font-semibold text-bt-rose-dark">{money(pkg.price, currency)}</span>
                  {pkg.compareAt && pkg.compareAt > pkg.price ? <span className="text-xs text-bt-mute line-through">{money(pkg.compareAt, currency)}</span> : <span className="text-xs">&nbsp;</span>}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : (
        <p className="font-display text-xl">{product.name}</p>
      )}
      <div className="flex items-center justify-between gap-4">
        <span className="pl-1 font-medium">পরিমাণ</span>
        <QuantityStepper
          value={quantity}
          onChange={(next) => line && setQuantity(next)}
          skin={{
            box: 'flex h-12 items-center overflow-hidden rounded-full border-2 border-bt-line',
            button: 'h-full w-12 text-2xl text-bt-rose hover:bg-bt-rose-light disabled:opacity-40 disabled:hover:bg-transparent',
            value: 'min-w-[44px] text-center font-display text-xl',
          }}
        />
      </div>
    </div>
  );
}

function Order({ s }: { s: S }) {
  return (
    <section data-section="order" className="py-14 md:py-24">
      <div className={WRAP}>
        <div className="mx-auto max-w-2xl">
          <div className="mb-8 text-center">
            {asText(s.eyebrow) ? <p className={EYEBROW}>{asText(s.eyebrow)}</p> : null}
            <h2 className={H2}>{asText(s.title)}</h2>
            {asText(s.subtitle) ? <p className="mt-2 text-bt-mute">{asText(s.subtitle)}</p> : null}
          </div>
          <LandingOrderForm
            showSavings
            skin={ORDER_SKIN}
            texts={{ buttonLabel: asText(s.buttonLabel) || 'অর্ডার কনফার্ম করুন', note: asText(s.note), successText: asText(s.successText) }}
            products={<PackagePicker />}
          />
        </div>
      </div>
    </section>
  );
}

function Footer({ s }: { s: S }) {
  const { brand } = useLanding();
  const phone = asText(s.phone);
  const links = [
    { url: asText(s.facebookUrl), icon: 'facebook', label: 'Facebook' },
    { url: asText(s.instagramUrl), icon: 'instagram', label: 'Instagram' },
  ].filter((l) => l.url);
  return (
    <footer data-section="footer" className="rounded-t-[2.5rem] bg-bt-plum pb-28 pt-12 text-bt-cream md:rounded-t-[4rem] md:pb-10">
      <div className={WRAP}>
        <div className="grid items-center gap-8 md:grid-cols-2">
          <div>
            <p className="font-display text-4xl">{brand}</p>
            {asText(s.text) ? <p className="mt-2 max-w-sm leading-snug text-bt-cream/70">{asText(s.text)}</p> : null}
          </div>
          <div className="space-y-3 md:text-right">
            {phone ? (
              <a href={`tel:${phone.replace(/[^\d+]/g, '')}`} className="inline-flex min-h-[44px] items-center gap-2 text-lg">
                <LpIcon name="phone" className="h-5 w-5" strokeWidth={1.5} />
                {phone}
              </a>
            ) : null}
            {links.length > 0 ? (
              <div className="flex gap-2 md:justify-end">
                {links.map((l) => (
                  <a key={l.icon} href={l.url} target="_blank" rel="noopener noreferrer" aria-label={l.label} className="flex h-11 w-11 items-center justify-center rounded-full border border-bt-cream/30 transition-colors hover:bg-bt-cream hover:text-bt-plum">
                    <LpIcon name={l.icon} className="h-5 w-5" strokeWidth={1.5} />
                  </a>
                ))}
              </div>
            ) : null}
          </div>
        </div>
        <p className="mt-10 border-t border-bt-cream/15 pt-5 text-xs leading-relaxed text-bt-cream/50">
          © {new Date().getFullYear()} {brand}। সর্বস্বত্ব সংরক্ষিত। {asText(s.disclaimer)}
        </p>
      </div>
    </footer>
  );
}

function StickyBar() {
  const { scrollTo, currency } = useLanding();
  const show = useStickyBar();
  const { price, variantName, quantity } = useMainLine();
  return (
    <div
      aria-hidden={!show}
      className={`fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-3 border-t border-bt-line bg-white/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_20px_rgb(var(--bt-rose)/0.12)] backdrop-blur transition-transform duration-300 md:hidden ${show ? 'translate-y-0' : 'invisible translate-y-full'}`}
    >
      <div className="leading-tight">
        <div className="font-display text-2xl text-bt-rose-dark">{money(price * quantity, currency)}</div>
        <div className="text-xs leading-tight text-bt-mute">{[variantName, quantity > 1 ? `${toBn(quantity)}টি` : null].filter(Boolean).join(' · ')}</div>
      </div>
      <button type="button" tabIndex={show ? 0 : -1} onClick={() => scrollTo('order')} className={`${ROSE_BTN} h-12 px-8`}>
        অর্ডার করুন
      </button>
    </div>
  );
}

const SECTIONS: Record<string, (props: { s: S }) => ReactNode> = {
  hero: Hero,
  concerns: Concerns,
  ingredients: Ingredients,
  skin_types: SkinTypes,
  how_to_use: HowToUse,
  before_after: BeforeAfter,
  results: Results,
  reviews: Reviews,
  authenticity: Authenticity,
  packages: Packages,
  faq: Faq,
  order: Order,
  footer: Footer,
};

export function BeautyTemplate() {
  const { content } = useLanding();
  return (
    <div className="bg-bt-cream font-sans leading-[1.8] text-bt-plum antialiased">
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
