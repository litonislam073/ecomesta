'use client';

import { useState, type ReactNode } from 'react';
import type { LandingValue } from '@ecomesta/utils';
import { FaqList, LazyVideo, LpIcon, Marked, Pic, Reveal, Stars, useStickyBar } from '../landing-bits';
import { asItems, asText, itemText, money, toBn, useLanding } from '../landing-context';
import { TimerCells, cells, useMainLine, type TimerSkin } from '../landing-kit';
import { LandingOrderForm, type OrderSkin } from '../landing-order-form';
import { QuantityStepper } from '../landing-pickers';

type S = Record<string, LandingValue>;

const WRAP = 'mx-auto w-full max-w-6xl px-5 md:px-10';
const EYEBROW = 'text-xs font-semibold uppercase tracking-[0.2em] text-hm-clay';
const H2 = 'mt-2 font-display text-3xl font-semibold leading-tight text-hm-ink md:text-5xl';
const CLAY_BTN = 'inline-flex items-center justify-center rounded-2xl bg-hm-clay font-semibold text-white shadow-md shadow-hm-clay/25 transition-colors hover:bg-hm-clay-dark focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-hm-clay/30';

const TIMER: TimerSkin = {
  box: 'inline-flex items-center gap-2 text-center',
  cell: 'min-w-[54px] rounded-xl border border-hm-line bg-hm-sand px-2 py-1.5',
  value: 'font-display text-2xl font-semibold leading-none text-hm-clay-dark',
  label: 'text-[11px] text-hm-mute',
};

const ORDER_SKIN: OrderSkin = {
  form: 'rounded-[2rem] border border-hm-line bg-white p-5 md:p-9',
  label: 'mb-1.5 block font-medium',
  input: 'h-12 w-full rounded-xl border border-hm-line bg-hm-linen px-4 text-base placeholder:text-hm-mute/60 focus:border-hm-clay focus:outline-none focus:ring-2 focus:ring-hm-clay/20',
  inputInvalid: 'border-hm-bad',
  select: 'h-12 w-full rounded-xl border border-hm-line bg-hm-linen px-3 text-base focus:border-hm-clay focus:outline-none focus:ring-2 focus:ring-hm-clay/20 disabled:opacity-60',
  error: 'mt-1 text-sm text-hm-bad',
  choice: 'flex cursor-pointer items-center gap-3 rounded-2xl border-2 border-hm-line bg-white p-4 has-[:checked]:border-hm-clay has-[:checked]:bg-hm-clay-light has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-hm-clay',
  choiceTitle: 'block font-medium',
  choiceHint: 'block text-sm text-hm-mute',
  choicePrice: 'font-display font-semibold text-hm-clay-dark',
  radio: 'h-4 w-4 accent-[rgb(var(--hm-clay))]',
  summary: 'space-y-2 rounded-2xl bg-hm-sand p-5',
  summaryLabel: 'text-hm-mute',
  summaryValue: '',
  totalLabel: 'font-semibold',
  totalValue: 'font-display text-3xl font-semibold text-hm-clay-dark',
  divider: 'mt-3 border-t border-hm-line pt-1',
  savingValue: 'font-semibold text-hm-sage',
  formError: 'mb-3 text-center text-sm text-hm-bad',
  button: `${CLAY_BTN} h-14 w-full text-lg disabled:opacity-60`,
  note: 'mt-3 text-center text-sm text-hm-mute',
  success: {
    box: 'rounded-[2rem] border-2 border-hm-sage bg-white p-8 text-center focus:outline-none',
    icon: 'mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-hm-sage text-white',
    title: 'mt-4 font-display text-4xl font-semibold',
    text: 'mt-3 text-lg',
    total: 'mt-2 font-semibold text-hm-clay-dark',
    link: 'mt-6 inline-flex h-11 items-center rounded-2xl border-2 border-hm-clay px-6 font-semibold text-hm-clay-dark hover:bg-hm-clay-light',
  },
};

function ScrollButton({ label, className = '', hero }: { label: string; className?: string; hero?: boolean }) {
  const { scrollTo } = useLanding();
  if (!label) return null;
  return (
    <button type="button" data-hero-cta={hero ? '' : undefined} onClick={() => scrollTo('order')} className={`${CLAY_BTN} h-14 px-12 text-lg ${className}`}>
      {label}
    </button>
  );
}

function Header({ eyebrow, title, center }: { eyebrow: string; title: string; center?: boolean }) {
  return (
    <Reveal className={center ? 'mx-auto max-w-2xl text-center' : 'max-w-xl'}>
      {eyebrow ? <p className={EYEBROW}>{eyebrow}</p> : null}
      <h2 className={H2}>{title}</h2>
    </Reveal>
  );
}

/** Size buttons for the product's variants, with a line under each from the hero settings. */
function SizePicker({ hints }: { hints: string[] }) {
  const { product, variantId, setVariant } = useMainLine();
  if (!product || product.variants.length < 2) return null;
  return (
    <div className="grid grid-cols-3 gap-2" role="group" aria-label="সাইজ বাছুন">
      {product.variants.map((v, i) => {
        const active = v.id === variantId;
        return (
          <button
            key={v.id}
            type="button"
            aria-pressed={active}
            disabled={!v.available}
            onClick={() => setVariant(v.id)}
            className={`rounded-2xl border-2 px-2 py-3 text-center transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hm-clay disabled:opacity-40 ${active ? 'border-hm-clay bg-hm-clay-light' : 'border-hm-line bg-white'}`}
          >
            <span className="block font-display text-xl font-semibold leading-none">{v.name}</span>
            {hints[i] ? <span className="mt-1.5 block text-xs leading-tight text-hm-mute">{hints[i]}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

function Hero({ s }: { s: S }) {
  const { brand, scrollTo, countdownEnd, currency } = useLanding();
  const { product, price, compareAt, variantName } = useMainLine();
  const image = asText(s.imageUrl) || product?.imageUrl || '';
  const save = compareAt && compareAt > price ? compareAt - price : 0;
  const hints = asItems(s.options).map((o) => itemText(o, 'hint'));
  return (
    <section data-section="hero" className="bg-hm-sand">
      <div className={WRAP}>
        <div className="flex items-center justify-between py-5">
          <span className="font-display text-2xl font-semibold tracking-tight">{asText(s.brand) || brand}</span>
          <button type="button" onClick={() => scrollTo('order')} className="py-2 text-sm font-semibold text-hm-clay-dark">
            অর্ডার করুন
          </button>
        </div>
        <div className="grid items-center gap-0 pb-12 md:grid-cols-12 md:gap-8 md:pb-20">
          <div className="md:order-2 md:col-span-7">
            <Pic src={image} alt={product?.name ?? ''} eager className="aspect-[5/4] w-full rounded-[2rem] bg-hm-sand-deep object-cover" />
          </div>
          <div className="relative mx-2 -mt-10 rounded-[2rem] bg-hm-linen p-6 shadow-xl shadow-hm-ink/5 md:order-1 md:col-span-5 md:mx-0 md:mt-0 md:bg-transparent md:p-0 md:shadow-none">
            {asText(s.eyebrow) ? <p className={EYEBROW}>{asText(s.eyebrow)}</p> : null}
            <h1 className="mt-2 font-display text-4xl font-semibold leading-[1.1] md:text-6xl">
              <Marked text={asText(s.title)} markClass="bg-transparent text-hm-clay" />
            </h1>
            {asText(s.subtitle) ? <p className="mt-3 text-lg text-hm-mute">{asText(s.subtitle)}</p> : null}
            {product ? (
              <p className="mt-5 flex flex-wrap items-baseline gap-x-3">
                <span className="font-display text-4xl font-semibold text-hm-clay-dark md:text-5xl">{money(price, currency)}</span>
                {save > 0 ? <span className="text-xl text-hm-mute line-through">{money(compareAt!, currency)}</span> : null}
                {save > 0 ? <span className="rounded-full bg-hm-sage/15 px-3 py-0.5 text-sm font-semibold text-hm-sage">{money(save, currency)} সাশ্রয়</span> : null}
              </p>
            ) : null}
            {product && product.variants.length > 1 ? (
              <>
                <p className="mt-4 text-sm font-medium">
                  {asText(s.pickerLabel) || 'বাছুন'}: <b>{variantName}</b>
                </p>
                <div className="mt-2">
                  <SizePicker hints={hints} />
                </div>
              </>
            ) : null}
            <ScrollButton label={asText(s.buttonLabel)} hero className="mt-5 w-full md:w-auto" />
            {asText(s.note) ? <p className="mt-3 text-sm text-hm-mute">{asText(s.note)}</p> : null}
            {countdownEnd !== null ? (
              <div className="mt-4">
                {asText(s.countdownLabel) ? <p className="mb-2 text-xs text-hm-mute">{asText(s.countdownLabel)}</p> : null}
                <TimerCells skin={TIMER} />
              </div>
            ) : null}
          </div>
        </div>
      </div>
      <div className="lp-hm-wood h-3" aria-hidden="true" />
    </section>
  );
}

function Gallery({ s }: { s: S }) {
  const images = asItems(s.images).filter((i) => itemText(i, 'imageUrl'));
  const [active, setActive] = useState(0);
  if (images.length === 0) return null;
  const index = Math.min(active, images.length - 1);
  const current = images[index]!;
  const go = (delta: number) => setActive((index + delta + images.length) % images.length);
  return (
    <section data-section="gallery" className="py-14 md:py-24">
      <div className={WRAP}>
        <Header eyebrow={asText(s.eyebrow)} title={asText(s.title)} />
        <Reveal className="mt-8 grid gap-4 md:grid-cols-12 md:gap-6">
          <div className="relative md:order-2 md:col-span-9">
            <Pic src={itemText(current, 'imageUrl')} alt={itemText(current, 'alt')} className="aspect-[5/4] w-full rounded-[2rem] bg-hm-sand object-cover" />
            {images.length > 1 ? (
              <>
                <button type="button" onClick={() => go(-1)} aria-label="আগের ছবি" className="absolute left-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-hm-linen/90 shadow">
                  <LpIcon name="left" className="h-5 w-5" strokeWidth={1.5} />
                </button>
                <button type="button" onClick={() => go(1)} aria-label="পরের ছবি" className="absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-hm-linen/90 shadow">
                  <LpIcon name="right" className="h-5 w-5" strokeWidth={1.5} />
                </button>
              </>
            ) : null}
            {itemText(current, 'alt') ? (
              <p className="mt-3 text-center text-sm text-hm-mute" aria-live="polite">
                {itemText(current, 'alt')}
              </p>
            ) : null}
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1 md:order-1 md:col-span-3 md:flex-col md:overflow-visible" role="group" aria-label="থাম্বনেইল">
            {images.map((img, i) => (
              <button
                key={i}
                type="button"
                aria-current={i === index}
                aria-label={itemText(img, 'alt') || `ছবি ${toBn(i + 1)}`}
                onClick={() => setActive(i)}
                className={`w-20 shrink-0 overflow-hidden rounded-2xl bg-hm-sand transition md:w-full ${i === index ? 'ring-2 ring-hm-clay ring-offset-2 ring-offset-hm-linen' : 'opacity-70 hover:opacity-100'}`}
              >
                <Pic src={itemText(img, 'imageUrl')} alt="" className="aspect-[5/4] w-full object-cover" />
              </button>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Uses({ s }: { s: S }) {
  return (
    <section data-section="uses" className="bg-hm-sand py-14 md:py-24">
      <div className={WRAP}>
        <Header eyebrow={asText(s.eyebrow)} title={asText(s.title)} />
        <div className="mt-10 grid grid-cols-2 gap-4 md:gap-6 lg:grid-cols-3">
          {asItems(s.items).map((item, i) => (
            <Reveal as="figure" key={i} className="overflow-hidden rounded-[1.75rem] bg-hm-linen">
              <Pic src={itemText(item, 'imageUrl')} alt={itemText(item, 'title')} className="aspect-[4/3] w-full object-cover" />
              <figcaption className="p-4">
                <h3 className="font-display text-lg font-semibold leading-snug md:text-xl">{itemText(item, 'title')}</h3>
                {itemText(item, 'text') ? <p className="mt-0.5 text-sm leading-snug text-hm-mute">{itemText(item, 'text')}</p> : null}
              </figcaption>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Features({ s }: { s: S }) {
  return (
    <section data-section="features" className="py-14 md:py-24">
      <div className={WRAP}>
        <Header eyebrow={asText(s.eyebrow)} title={asText(s.title)} />
        <div className="mt-10 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {asItems(s.items).map((item, i) => (
            <Reveal key={i} className="flex gap-4">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-hm-clay-light text-hm-clay-dark">
                <LpIcon name={itemText(item, 'icon')} className="h-7 w-7" strokeWidth={1.5} />
              </span>
              <div>
                <h3 className="font-display text-xl font-semibold leading-snug">{itemText(item, 'title')}</h3>
                <p className="mt-1 leading-snug text-hm-mute">{itemText(item, 'text')}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Video({ s }: { s: S }) {
  return (
    <section data-section="video" className="bg-hm-sand py-14 md:py-24">
      <div className={WRAP}>
        <div className="mx-auto max-w-3xl">
          <Header eyebrow={asText(s.eyebrow)} title={asText(s.title)} />
          <LazyVideo
            url={asText(s.videoUrl)}
            poster={asText(s.posterUrl)}
            className="mt-8 rounded-[2rem] bg-hm-ink"
            buttonClass="flex h-20 w-20 items-center justify-center rounded-full bg-hm-clay text-white shadow-xl"
            noteClass="absolute inset-x-3 bottom-3 rounded-lg bg-white px-3 py-2 text-sm leading-snug text-hm-bad"
          />
        </div>
      </div>
    </section>
  );
}

function SizeGuide({ s }: { s: S }) {
  const { scrollTo } = useLanding();
  const { product, variantId, setVariant } = useMainLine();
  const cards = asItems(s.cards);
  return (
    <section data-section="size_guide" className="py-14 md:py-24">
      <div className={WRAP}>
        <Header eyebrow={asText(s.eyebrow)} title={asText(s.title)} />
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {cards.map((card, i) => {
            const variant = product?.variants[i];
            const badge = itemText(card, 'badge');
            const active = !!variant && variant.id === variantId;
            const points = itemText(card, 'points')
              .split('\n')
              .map((p) => p.trim())
              .filter(Boolean);
            return (
              <Reveal key={i} className={`relative flex flex-col rounded-[2rem] p-6 ${badge ? 'border-2 border-hm-clay bg-hm-clay-light' : 'border border-hm-line bg-white'} ${active ? 'ring-2 ring-hm-clay ring-offset-2 ring-offset-hm-linen' : ''}`}>
                {badge ? <span className="absolute -top-3 left-6 rounded-full bg-hm-clay px-3 py-1 text-xs font-semibold text-white">{badge}</span> : null}
                <p className="font-display text-5xl font-semibold leading-none text-hm-clay-dark">
                  {itemText(card, 'size')}
                  <span className="text-xl"> {itemText(card, 'unit')}</span>
                </p>
                <p className="mt-3 text-lg font-semibold">{itemText(card, 'title')}</p>
                {itemText(card, 'text') ? <p className="text-sm text-hm-mute">{itemText(card, 'text')}</p> : null}
                <ul className="mt-4 flex-1 space-y-2">
                  {points.map((p, j) => (
                    <li key={j} className="flex gap-2 leading-snug">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-hm-sage text-white">
                        <LpIcon name="check" className="h-3 w-3" strokeWidth={3} />
                      </span>
                      {p}
                    </li>
                  ))}
                </ul>
                {variant ? (
                  <button
                    type="button"
                    disabled={!variant.available}
                    onClick={() => {
                      setVariant(variant.id);
                      scrollTo('order');
                    }}
                    className={`mt-5 h-12 w-full rounded-2xl font-semibold transition-colors disabled:opacity-40 ${badge ? CLAY_BTN : 'border-2 border-hm-clay text-hm-clay-dark hover:bg-hm-clay-light'}`}
                  >
                    {variant.available ? `${variant.name} ${asText(s.buttonSuffix)}`.trim() : 'স্টক শেষ'}
                  </button>
                ) : null}
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Specs({ s }: { s: S }) {
  const columns = cells(asText(s.columns));
  const highlight = Number(s.highlight) || 0;
  return (
    <section data-section="specs" className="bg-hm-sand py-14 md:py-24">
      <div className={WRAP}>
        <div className="mx-auto max-w-3xl">
          <Header eyebrow={asText(s.eyebrow)} title={asText(s.title)} />
          <Reveal className="mt-8 overflow-x-auto rounded-[1.75rem] bg-hm-linen">
            <table className="w-full min-w-[420px] text-sm md:text-base">
              {columns.length > 0 ? (
                <thead>
                  <tr className="border-b border-hm-line text-left">
                    <th scope="col" className="px-4 py-3.5">
                      <span className="sr-only">বিষয়</span>
                    </th>
                    {columns.map((c, i) => (
                      <th key={i} scope="col" className={`px-3 py-3.5 font-display font-semibold ${highlight === i + 1 ? 'text-hm-clay-dark' : ''}`}>
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
              ) : null}
              <tbody>
                {asItems(s.rows).map((row, i) => (
                  <tr key={i} className="border-b border-hm-line last:border-0">
                    <th scope="row" className="px-4 py-3 text-left align-top font-medium text-hm-mute">
                      {itemText(row, 'label')}
                    </th>
                    {cells(itemText(row, 'values')).map((v, j) => (
                      <td key={j} className="px-3 py-3 align-top">
                        {v}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function InTheBox({ s }: { s: S }) {
  return (
    <section data-section="in_the_box" className="py-14 md:py-24">
      <div className={WRAP}>
        <Header eyebrow={asText(s.eyebrow)} title={asText(s.title)} />
        <ul className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-5">
          {asItems(s.items).map((item, i) => (
            <Reveal as="li" key={i} className="text-center">
              <Pic src={itemText(item, 'imageUrl')} alt={itemText(item, 'name')} className="aspect-square w-full rounded-[1.5rem] bg-hm-sand object-cover" />
              <p className="mt-3 text-sm font-medium leading-snug md:text-base">{itemText(item, 'name')}</p>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Reviews({ s }: { s: S }) {
  return (
    <section data-section="reviews" className="bg-hm-sand py-14 md:py-24">
      <div className={WRAP}>
        <Reveal className="max-w-xl">
          {asText(s.eyebrow) ? <p className={EYEBROW}>{asText(s.eyebrow)}</p> : null}
          <h2 className={H2}>{asText(s.title)}</h2>
          {asText(s.rating) ? (
            <p className="mt-2 flex items-center gap-1 text-hm-star" aria-label={`গড় রেটিং ${asText(s.rating)}`}>
              <Stars rating={5} className="h-5 w-5" />
              <span className="ml-2 font-semibold text-hm-ink">{asText(s.rating)} / ৫</span>
            </p>
          ) : null}
        </Reveal>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {asItems(s.items).map((review, i) => (
            <Reveal as="figure" key={i} className="flex flex-col overflow-hidden rounded-[1.75rem] bg-hm-linen">
              {itemText(review, 'imageUrl') ? <Pic src={itemText(review, 'imageUrl')} alt={`${itemText(review, 'name')}-এর রান্নাঘরে`} className="aspect-[6/5] w-full object-cover" /> : null}
              <div className="flex-1 p-5">
                <span className="text-hm-star">
                  <Stars rating={Number(review.rating)} className="h-4 w-4" />
                </span>
                <blockquote className="mt-2 text-sm leading-relaxed md:text-base">“{itemText(review, 'text')}”</blockquote>
                <figcaption className="mt-3 text-sm text-hm-mute">
                  <b className="text-hm-ink">{itemText(review, 'name')}</b>
                  {itemText(review, 'location') ? `, ${itemText(review, 'location')}` : ''}
                  {itemText(review, 'family') ? <span className="block text-xs">{itemText(review, 'family')}</span> : null}
                </figcaption>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Support({ s }: { s: S }) {
  return (
    <section data-section="support" className="py-14 md:py-24">
      <div className={WRAP}>
        <div className="grid items-start gap-10 md:grid-cols-12">
          <Reveal className="md:col-span-5">
            {asText(s.eyebrow) ? <p className={EYEBROW}>{asText(s.eyebrow)}</p> : null}
            <h2 className={H2}>{asText(s.title)}</h2>
            {asText(s.text) ? <p className="mt-3 text-hm-mute">{asText(s.text)}</p> : null}
            <ScrollButton label={asText(s.buttonLabel)} className="mt-6 px-10" />
          </Reveal>
          <ul className="grid gap-4 sm:grid-cols-2 md:col-span-7">
            {asItems(s.items).map((item, i) => (
              <Reveal as="li" key={i} className="rounded-[1.75rem] border border-hm-line bg-white p-5">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-hm-clay-light text-hm-clay-dark">
                  <LpIcon name={itemText(item, 'icon')} className="h-6 w-6" strokeWidth={1.5} />
                </span>
                <h3 className="mt-3 font-display text-xl font-semibold">{itemText(item, 'title')}</h3>
                <p className="mt-1 text-sm leading-snug text-hm-mute md:text-base">{itemText(item, 'text')}</p>
              </Reveal>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function Faq({ s }: { s: S }) {
  return (
    <section data-section="faq" className="bg-hm-sand py-14 md:py-24">
      <div className={WRAP}>
        <div className="mx-auto max-w-3xl">
          <Header eyebrow={asText(s.eyebrow)} title={asText(s.title)} />
          <div className="mt-8 space-y-3">
            <FaqList
              items={asItems(s.items)}
              skin={{
                item: 'rounded-2xl bg-hm-linen',
                button: 'flex min-h-[60px] w-full items-center justify-between gap-4 px-5 py-4 text-left',
                question: 'font-semibold leading-snug',
                panel: 'px-5 pb-5 leading-relaxed text-hm-mute',
                chevron: 'h-5 w-5 text-hm-clay',
              }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function OrderProduct() {
  const { settings, currency } = useLanding();
  const { product, price, compareAt, variantName, quantity, setQuantity, line } = useMainLine();
  const hints = asItems(settings('hero')?.options).map((o) => itemText(o, 'hint'));
  if (!product) return <p className="py-6 text-center text-hm-mute">এই অফারটি এখন পাওয়া যাচ্ছে না।</p>;
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 rounded-2xl bg-hm-sand p-3">
        <Pic src={product.imageUrl ?? ''} alt={product.name} className="h-20 w-20 shrink-0 rounded-xl bg-hm-sand-deep object-cover" />
        <div className="min-w-0">
          <p className="font-display text-lg font-semibold leading-tight">{product.name}</p>
          {variantName ? <p className="text-sm text-hm-mute">{variantName}</p> : null}
          <p className="mt-1 flex items-baseline gap-2">
            <span className="font-display text-xl font-semibold text-hm-clay-dark">{money(price, currency)}</span>
            {compareAt && compareAt > price ? <span className="text-sm text-hm-mute line-through">{money(compareAt, currency)}</span> : null}
          </p>
        </div>
      </div>
      {product.variants.length > 1 ? (
        <fieldset>
          <legend className="mb-1.5 block font-medium">সাইজ বাছুন</legend>
          <SizePicker hints={hints} />
        </fieldset>
      ) : null}
      <div className="flex items-center justify-between gap-4">
        <span className="font-medium">পরিমাণ</span>
        <QuantityStepper
          value={quantity}
          onChange={(next) => line && setQuantity(next)}
          skin={{
            box: 'flex h-12 items-center overflow-hidden rounded-xl border border-hm-line bg-white',
            button: 'h-full w-12 text-2xl text-hm-clay-dark hover:bg-hm-clay-light disabled:opacity-40 disabled:hover:bg-transparent',
            value: 'min-w-[44px] text-center font-display text-xl font-semibold',
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
            {asText(s.subtitle) ? <p className="mt-2 text-hm-mute">{asText(s.subtitle)}</p> : null}
          </div>
          <LandingOrderForm
            showSavings
            skin={ORDER_SKIN}
            texts={{ buttonLabel: asText(s.buttonLabel) || 'অর্ডার কনফার্ম করুন', note: asText(s.note), successText: asText(s.successText) }}
            products={<OrderProduct />}
          />
        </div>
      </div>
    </section>
  );
}

function Footer({ s }: { s: S }) {
  const { brand } = useLanding();
  const phone = asText(s.phone);
  const facebook = asText(s.facebookUrl);
  return (
    <footer data-section="footer" className="bg-hm-ink text-hm-linen">
      <div className="lp-hm-wood h-3" aria-hidden="true" />
      <div className={`${WRAP} pb-28 pt-12 md:pb-10`}>
        <div className="grid items-center gap-8 md:grid-cols-2">
          <div>
            <p className="font-display text-3xl font-semibold">{brand}</p>
            {asText(s.text) ? <p className="mt-2 max-w-sm leading-snug text-hm-linen/70">{asText(s.text)}</p> : null}
          </div>
          <div className="space-y-3 md:text-right">
            {phone ? (
              <a href={`tel:${phone.replace(/[^\d+]/g, '')}`} className="inline-flex min-h-[44px] items-center gap-2 text-lg">
                <LpIcon name="phone" className="h-5 w-5" strokeWidth={1.5} />
                {phone}
              </a>
            ) : null}
            {facebook ? (
              <div>
                <a href={facebook} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center gap-2 rounded-2xl border border-hm-linen/30 px-4 transition-colors hover:bg-hm-linen hover:text-hm-ink">
                  <LpIcon name="facebook" className="h-5 w-5" strokeWidth={1.5} />
                  Facebook পেজ
                </a>
              </div>
            ) : null}
          </div>
        </div>
        <p className="mt-10 border-t border-hm-linen/15 pt-5 text-xs text-hm-linen/50">
          © {new Date().getFullYear()} {brand}। সর্বস্বত্ব সংরক্ষিত।
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
      className={`fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-3 border-t border-hm-line bg-hm-linen/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_20px_rgba(51,48,44,.08)] backdrop-blur transition-transform duration-300 md:hidden ${show ? 'translate-y-0' : 'invisible translate-y-full'}`}
    >
      <div className="leading-tight">
        <div className="font-display text-2xl font-semibold text-hm-clay-dark">{money(price * quantity, currency)}</div>
        <div className="text-xs leading-tight text-hm-mute">{[variantName, quantity > 1 ? `${toBn(quantity)}টি` : null].filter(Boolean).join(' · ')}</div>
      </div>
      <button type="button" tabIndex={show ? 0 : -1} onClick={() => scrollTo('order')} className={`${CLAY_BTN} h-12 px-8`}>
        অর্ডার করুন
      </button>
    </div>
  );
}

const SECTIONS: Record<string, (props: { s: S }) => ReactNode> = {
  hero: Hero,
  gallery: Gallery,
  uses: Uses,
  features: Features,
  video: Video,
  size_guide: SizeGuide,
  specs: Specs,
  in_the_box: InTheBox,
  reviews: Reviews,
  support: Support,
  faq: Faq,
  order: Order,
  footer: Footer,
};

export function HomeTemplate() {
  const { content } = useLanding();
  return (
    <div className="bg-hm-linen font-sans leading-[1.8] text-hm-ink antialiased">
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
