'use client';

import type { ReactNode } from 'react';
import type { LandingValue } from '@ecomesta/utils';
import { FaqList, LazyVideo, LpIcon, Marked, Pic, Reveal, Stars, useStickyBar } from '../landing-bits';
import { asItems, asText, discountPercent, itemText, money, toBn, useLanding } from '../landing-context';
import { TimerCells, swatchFor, swatchHex, useMainLine, type TimerSkin } from '../landing-kit';
import { LandingOrderForm, type OrderSkin } from '../landing-order-form';
import { QuantityStepper } from '../landing-pickers';

type S = Record<string, LandingValue>;

const WRAP = 'mx-auto w-full max-w-6xl px-5 md:px-10';
const EYEBROW = 'font-display text-xs font-semibold uppercase tracking-[0.22em] text-gd-cyan';
const H2 = 'mt-2 font-display text-3xl font-bold leading-tight text-gd-ice md:text-5xl';
const GLASS = 'rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur';
const GLOW = 'shadow-[0_0_30px_rgb(var(--gd-cyan)/0.45)]';
const CTA = `inline-flex h-14 items-center justify-center rounded-xl bg-gd-cyan px-10 font-display text-lg font-bold text-gd-night ${GLOW} transition-colors hover:bg-gd-cyan-soft focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-gd-cyan/40`;

const TIMER: TimerSkin = {
  box: 'inline-flex items-center gap-2 text-center',
  cell: `min-w-[56px] px-2 py-1.5 ${GLASS}`,
  value: 'font-display text-2xl font-bold leading-none text-gd-cyan',
  label: 'mt-0.5 text-[11px] text-gd-mist',
};

const CHOICE = 'flex cursor-pointer items-center gap-3 rounded-xl border border-white/15 bg-white/5 p-3 has-[:checked]:border-gd-cyan has-[:checked]:bg-gd-cyan/10 has-[:checked]:shadow-[0_0_0_1px_rgb(var(--gd-cyan))] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-gd-cyan';

const ORDER_SKIN: OrderSkin = {
  form: `${GLASS} p-5 md:p-8`,
  label: 'mb-1.5 block font-medium text-gd-ice',
  input: 'h-12 w-full rounded-xl border border-white/15 bg-white/5 px-4 text-base text-gd-ice placeholder:text-gd-mist/60 focus:border-gd-cyan focus:outline-none focus:ring-2 focus:ring-gd-cyan/30',
  inputInvalid: 'border-gd-bad',
  select: 'h-12 w-full rounded-xl border border-white/15 bg-gd-navy px-3 text-base text-gd-ice focus:border-gd-cyan focus:outline-none focus:ring-2 focus:ring-gd-cyan/30 disabled:opacity-60',
  error: 'mt-1 text-sm text-gd-bad',
  choice: CHOICE,
  choiceTitle: 'block font-medium',
  choiceHint: 'block text-sm text-gd-mist',
  choicePrice: 'font-display font-semibold text-gd-cyan',
  radio: 'h-4 w-4 accent-[rgb(var(--gd-cyan))]',
  summary: 'space-y-2 rounded-xl border border-white/10 bg-gd-night/60 p-5',
  summaryLabel: 'text-gd-mist',
  summaryValue: '',
  totalLabel: 'font-semibold',
  totalValue: 'font-display text-3xl font-bold text-gd-cyan',
  divider: 'mt-3 border-t border-white/10 pt-1',
  savingValue: 'text-gd-lime',
  formError: 'mb-3 text-center text-sm text-gd-bad',
  button: `h-14 w-full rounded-xl bg-gd-cyan font-display text-lg font-bold text-gd-night ${GLOW} transition-colors hover:bg-gd-cyan-soft disabled:opacity-60`,
  note: 'mt-3 text-center text-sm text-gd-mist',
  success: {
    box: `${GLASS} border-gd-lime/40 p-8 text-center focus:outline-none`,
    icon: 'mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gd-lime text-gd-night',
    title: 'mt-4 font-display text-4xl font-bold',
    text: 'mt-3 text-lg',
    total: 'mt-2 font-semibold text-gd-cyan',
    link: 'mt-6 inline-flex h-11 items-center rounded-xl border border-white/20 px-6 font-semibold hover:border-gd-cyan hover:text-gd-cyan',
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

function Header({ eyebrow, title, center }: { eyebrow: string; title: string; center?: boolean }) {
  return (
    <Reveal className={center ? 'mx-auto max-w-2xl text-center' : 'max-w-2xl'}>
      {eyebrow ? <p className={EYEBROW}>{eyebrow}</p> : null}
      <h2 className={H2}>{title}</h2>
    </Reveal>
  );
}

/** Colour swatches for the product's variants (names matched to the hero's swatch list). */
function Swatches({ s, size = 'h-11 w-11' }: { s: S | undefined; size?: string }) {
  const { product, variantId, setVariant } = useMainLine();
  if (!product || product.variants.length < 2) return null;
  return (
    <div className="flex flex-wrap items-center justify-center gap-3 md:justify-start" role="group" aria-label="রং বাছুন">
      {product.variants.map((v) => {
        const hex = swatchHex(swatchFor(s?.swatches, v.name));
        const active = v.id === variantId;
        return hex ? (
          <button
            key={v.id}
            type="button"
            title={v.name}
            aria-label={v.name}
            aria-pressed={active}
            disabled={!v.available}
            onClick={() => setVariant(v.id)}
            className={`${size} rounded-full border-2 border-white/30 ring-offset-2 ring-offset-gd-night transition disabled:opacity-30 ${active ? 'ring-2 ring-gd-cyan' : ''}`}
            style={{ background: hex }}
          />
        ) : (
          <button
            key={v.id}
            type="button"
            aria-pressed={active}
            disabled={!v.available}
            onClick={() => setVariant(v.id)}
            className={`h-11 rounded-xl border px-4 text-sm font-medium transition disabled:opacity-30 ${active ? 'border-gd-cyan bg-gd-cyan/10 text-gd-cyan' : 'border-white/15 text-gd-ice'}`}
          >
            {v.name}
          </button>
        );
      })}
    </div>
  );
}

function useHeroImage(s: S | undefined) {
  const { product, variantName } = useMainLine();
  const fromSwatch = variantName ? itemText(swatchFor(s?.swatches, variantName) ?? {}, 'imageUrl') : '';
  return fromSwatch || asText(s?.imageUrl) || product?.imageUrl || '';
}

function Hero({ s }: { s: S }) {
  const { brand, scrollTo, currency } = useLanding();
  const { product, price, compareAt, variantName } = useMainLine();
  const image = useHeroImage(s);
  const save = compareAt && compareAt > price ? compareAt - price : 0;
  return (
    <section data-section="hero" className="relative overflow-hidden">
      <div className="lp-gd-grid absolute inset-0" aria-hidden="true" />
      <div className="absolute left-1/2 top-24 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-gd-cyan/25 blur-[110px] md:h-[640px] md:w-[640px]" aria-hidden="true" />
      <div className={`relative ${WRAP}`}>
        <div className="flex items-center justify-between py-5">
          <span className="font-display text-xl font-bold tracking-tight">{asText(s.brand) || brand}</span>
          <button type="button" onClick={() => scrollTo('order')} className="py-2 text-sm font-medium text-gd-cyan">
            অর্ডার করুন →
          </button>
        </div>
        <div className="grid items-center gap-6 pb-14 md:grid-cols-2 md:gap-12 md:pb-24 md:pt-6">
          <div className="relative order-1 md:order-2">
            <Pic src={image} alt={product?.name ?? ''} eager className="relative mx-auto aspect-square w-full max-w-md rounded-[2rem] border border-white/10 bg-gd-navy object-cover transition-opacity" />
          </div>
          <div className="order-2 text-center md:order-1 md:text-left">
            {asText(s.badge) ? (
              <p className="inline-flex items-center gap-2 rounded-full border border-gd-cyan/30 bg-gd-cyan/10 px-3 py-1 font-display text-xs font-semibold text-gd-cyan">
                <span className="h-1.5 w-1.5 rounded-full bg-gd-cyan" />
                {asText(s.badge)}
              </p>
            ) : null}
            <h1 className="mt-4 font-display text-4xl font-bold leading-[1.1] sm:text-5xl md:text-6xl">
              {asText(s.title)} {asText(s.titleHighlight) ? <span className="text-gd-cyan">{asText(s.titleHighlight)}</span> : null}
            </h1>
            {asText(s.subtitle) ? <p className="mt-2 text-lg text-gd-mist">{asText(s.subtitle)}</p> : null}
            {asText(s.promise) ? (
              <p className="mt-4 text-xl text-gd-ice/90">
                <Marked text={asText(s.promise)} markClass="bg-transparent font-bold text-gd-cyan" />
              </p>
            ) : null}
            {product ? (
              <p className="mt-5 flex flex-wrap items-baseline justify-center gap-3 md:justify-start">
                <span className="font-display text-5xl font-bold">{money(price, currency)}</span>
                {save > 0 ? <span className="text-xl text-gd-mist line-through">{money(compareAt!, currency)}</span> : null}
                {save > 0 ? <span className="rounded-full bg-gd-lime/15 px-3 py-0.5 text-sm font-semibold text-gd-lime">{money(save, currency)} সাশ্রয়</span> : null}
              </p>
            ) : null}
            {product && product.variants.length > 1 ? (
              <div className="mt-5">
                <p className="mb-2 text-sm text-gd-mist">
                  রং: <b className="text-gd-ice">{variantName}</b>
                </p>
                <Swatches s={s} />
              </div>
            ) : null}
            <div className="mt-6">
              <ScrollButton label={asText(s.buttonLabel)} hero className="w-full md:w-auto md:px-12" />
            </div>
            {asText(s.note) ? <p className="mt-3 text-sm text-gd-mist">{asText(s.note)}</p> : null}
            <TimerBlock label={asText(s.countdownLabel)} />
          </div>
        </div>
      </div>
    </section>
  );
}

function TimerBlock({ label }: { label: string }) {
  const { countdownEnd } = useLanding();
  if (countdownEnd === null) return null;
  return (
    <div className="mt-5">
      {label ? <p className="mb-2 text-xs text-gd-mist">{label}</p> : null}
      <TimerCells skin={TIMER} />
    </div>
  );
}

function Highlights({ s }: { s: S }) {
  return (
    <section data-section="highlights" className="border-t border-white/10 py-14 md:py-20">
      <div className={`${WRAP} grid grid-cols-2 gap-3 md:gap-5 lg:grid-cols-4`}>
        {asItems(s.items).map((item, i) => (
          <Reveal key={i} className={`${GLASS} p-4 text-center md:p-6 md:text-left`}>
            <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-gd-cyan/10 text-gd-cyan md:mx-0">
              <LpIcon name={itemText(item, 'icon')} className="h-6 w-6" strokeWidth={1.6} />
            </span>
            <p className="mt-4 font-display font-bold leading-none">
              <span className="text-4xl text-gd-ice md:text-5xl">{itemText(item, 'value')}</span> <span className="text-base text-gd-cyan md:text-lg">{itemText(item, 'unit')}</span>
            </p>
            <p className="mt-2 font-semibold">{itemText(item, 'title')}</p>
            {itemText(item, 'text') ? <p className="mt-0.5 text-sm leading-snug text-gd-mist">{itemText(item, 'text')}</p> : null}
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function Features({ s }: { s: S }) {
  return (
    <section data-section="features" className="bg-gd-navy py-14 md:py-24">
      <div className={WRAP}>
        <Header eyebrow={asText(s.eyebrow)} title={asText(s.title)} />
        <div className="mt-10 space-y-12 md:space-y-20">
          {asItems(s.items).map((item, i) => (
            <Reveal key={i} className="grid items-center gap-6 md:grid-cols-2 md:gap-14">
              <Pic src={itemText(item, 'imageUrl')} alt={itemText(item, 'title')} className={`aspect-[4/3] w-full rounded-2xl border border-white/10 object-cover ${i % 2 ? 'md:order-2' : ''}`} />
              <div className={i % 2 ? 'md:order-1' : ''}>
                <p className="font-display text-sm font-semibold text-gd-cyan">{String(i + 1).padStart(2, '0')}</p>
                <h3 className="mt-1 font-display text-2xl font-bold md:text-3xl">{itemText(item, 'title')}</h3>
                <p className="mt-3 text-lg text-gd-mist">{itemText(item, 'text')}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Specs({ s }: { s: S }) {
  return (
    <section data-section="specs" className="py-14 md:py-24">
      <div className={WRAP}>
        <div className="mx-auto max-w-3xl">
          <Header eyebrow={asText(s.eyebrow)} title={asText(s.title)} />
          <Reveal className={`mt-8 divide-y divide-white/10 overflow-hidden ${GLASS}`}>
            <dl className="divide-y divide-white/10">
              {asItems(s.rows).map((row, i) => (
                <div key={i} className="grid grid-cols-5 gap-3 px-4 py-3.5 md:px-6">
                  <dt className="col-span-2 text-sm text-gd-mist md:text-base">{itemText(row, 'label')}</dt>
                  <dd className="col-span-3 font-medium">{itemText(row, 'value')}</dd>
                </div>
              ))}
            </dl>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function InTheBox({ s }: { s: S }) {
  return (
    <section data-section="in_the_box" className="bg-gd-navy py-14 md:py-24">
      <div className={WRAP}>
        <Header eyebrow={asText(s.eyebrow)} title={asText(s.title)} center />
        <ul className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-5 md:gap-5">
          {asItems(s.items).map((item, i) => (
            <Reveal as="li" key={i} className={`${GLASS} p-3 text-center`}>
              <Pic src={itemText(item, 'imageUrl')} alt={itemText(item, 'name')} className="aspect-square w-full rounded-xl bg-gd-night object-cover" />
              <p className="mt-3 text-sm font-medium leading-snug md:text-base">{itemText(item, 'name')}</p>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Mark({ yes }: { yes: boolean }) {
  return yes ? (
    <span className="font-display text-lg font-bold text-gd-lime" aria-label="আছে">
      ✓
    </span>
  ) : (
    <span className="font-display text-lg font-bold text-gd-bad" aria-label="নেই">
      ✗
    </span>
  );
}

function Comparison({ s }: { s: S }) {
  return (
    <section data-section="comparison" className="py-14 md:py-24">
      <div className={WRAP}>
        <div className="mx-auto max-w-3xl">
          <Header eyebrow={asText(s.eyebrow)} title={asText(s.title)} />
          <Reveal className={`mt-8 overflow-hidden ${GLASS}`}>
            <table className="w-full text-center">
              <thead>
                <tr className="bg-gd-cyan/10 font-display text-sm">
                  <th scope="col" className="px-3 py-3 text-left font-semibold text-gd-mist md:px-5">
                    বিষয়
                  </th>
                  <th scope="col" className="px-2 py-3 font-semibold text-gd-cyan">
                    {asText(s.oursLabel)}
                  </th>
                  <th scope="col" className="px-2 py-3 font-semibold text-gd-mist">
                    {asText(s.othersLabel)}
                  </th>
                </tr>
              </thead>
              <tbody>
                {asItems(s.rows).map((row, i) => (
                  <tr key={i} className="border-t border-white/10">
                    <th scope="row" className="px-3 py-3 text-left text-sm font-normal leading-snug md:px-5 md:text-base">
                      {itemText(row, 'text')}
                    </th>
                    <td className="px-2 py-3">
                      <Mark yes={row.ours === true} />
                    </td>
                    <td className="px-2 py-3">
                      <Mark yes={row.others === true} />
                    </td>
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

function Video({ s }: { s: S }) {
  return (
    <section data-section="video" className="bg-gd-navy py-14 md:py-24">
      <div className={WRAP}>
        <div className="mx-auto max-w-3xl">
          <Header eyebrow={asText(s.eyebrow)} title={asText(s.title)} />
          <LazyVideo
            url={asText(s.videoUrl)}
            poster={asText(s.posterUrl)}
            className="mt-8 rounded-2xl border border-white/10 bg-gd-night"
            buttonClass={`flex h-20 w-20 items-center justify-center rounded-full bg-gd-cyan text-gd-night shadow-[0_0_40px_rgb(var(--gd-cyan)/0.6)]`}
            noteClass="absolute inset-x-3 bottom-3 rounded-lg bg-white px-3 py-2 text-sm leading-snug text-gd-night"
          />
        </div>
      </div>
    </section>
  );
}

function Reviews({ s }: { s: S }) {
  return (
    <section data-section="reviews" className="py-14 md:py-24">
      <div className={WRAP}>
        <Reveal className="max-w-2xl">
          {asText(s.eyebrow) ? <p className={EYEBROW}>{asText(s.eyebrow)}</p> : null}
          <h2 className={H2}>{asText(s.title)}</h2>
          {asText(s.rating) ? (
            <p className="mt-2 flex items-center gap-1 text-gd-lime" aria-label={`গড় রেটিং ${asText(s.rating)}`}>
              <Stars rating={5} className="h-5 w-5" />
              <span className="ml-2 font-display font-semibold text-gd-ice">{asText(s.rating)} / ৫</span>
            </p>
          ) : null}
        </Reveal>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {asItems(s.items).map((review, i) => (
            <Reveal as="figure" key={i} className={`flex flex-col overflow-hidden ${GLASS}`}>
              {itemText(review, 'imageUrl') ? <Pic src={itemText(review, 'imageUrl')} alt={`${itemText(review, 'name')}-এর তোলা ছবি`} className="aspect-[4/3] w-full object-cover" /> : null}
              <div className="flex-1 p-5">
                <span className="text-gd-lime">
                  <Stars rating={Number(review.rating)} className="h-4 w-4" />
                </span>
                <blockquote className="mt-2 text-sm leading-relaxed md:text-base">“{itemText(review, 'text')}”</blockquote>
                <figcaption className="mt-3 text-sm text-gd-mist">
                  <b className="text-gd-ice">{itemText(review, 'name')}</b>
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

function Warranty({ s }: { s: S }) {
  return (
    <section data-section="warranty" className="bg-gd-navy py-14 md:py-24">
      <div className={WRAP}>
        <div className="grid items-center gap-10 md:grid-cols-5">
          <Reveal className="text-center md:col-span-2">
            <div className="mx-auto flex h-40 w-40 items-center justify-center rounded-full border border-gd-cyan/40 shadow-[0_0_60px_rgb(var(--gd-cyan)/0.25)]" role="img" aria-label={`${asText(s.sealValue)} ${asText(s.sealLabel)}`}>
              <div className="flex h-32 w-32 flex-col items-center justify-center rounded-full border border-gd-cyan/60 bg-gd-cyan/10 leading-none">
                <span className="font-display text-5xl font-bold text-gd-cyan">{asText(s.sealValue)}</span>
                <span className="mt-1 text-sm font-semibold">{asText(s.sealLabel)}</span>
              </div>
            </div>
            <h2 className={`${H2} mt-6`}>{asText(s.title)}</h2>
            {asText(s.text) ? <p className="mt-2 text-gd-mist">{asText(s.text)}</p> : null}
          </Reveal>
          <ul className="grid gap-4 sm:grid-cols-2 md:col-span-3">
            {asItems(s.items).map((item, i) => (
              <Reveal as="li" key={i} className={`${GLASS} p-5`}>
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gd-cyan/10 text-gd-cyan">
                  <LpIcon name={itemText(item, 'icon')} className="h-6 w-6" strokeWidth={1.6} />
                </span>
                <h3 className="mt-3 font-display text-lg font-bold">{itemText(item, 'title')}</h3>
                <p className="mt-1 text-sm leading-snug text-gd-mist md:text-base">{itemText(item, 'text')}</p>
              </Reveal>
            ))}
          </ul>
        </div>
        <div className="mt-10 text-center">
          <ScrollButton label={asText(s.buttonLabel)} />
        </div>
      </div>
    </section>
  );
}

function Faq({ s }: { s: S }) {
  return (
    <section data-section="faq" className="py-14 md:py-24">
      <div className={WRAP}>
        <div className="mx-auto max-w-3xl">
          <Header eyebrow={asText(s.eyebrow)} title={asText(s.title)} />
          <div className="mt-8 space-y-3">
            <FaqList
              items={asItems(s.items)}
              skin={{
                item: GLASS,
                button: 'flex min-h-[60px] w-full items-center justify-between gap-4 px-5 py-4 text-left',
                question: 'font-semibold leading-snug',
                panel: 'px-5 pb-5 leading-relaxed text-gd-mist',
                chevron: 'h-5 w-5 text-gd-cyan',
              }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function ProductBox() {
  const { settings, currency } = useLanding();
  const hero = settings('hero');
  const { product, price, compareAt, variantName, quantity, setQuantity, line } = useMainLine();
  const image = useHeroImage(hero);
  if (!product) return <p className="py-6 text-center text-gd-mist">এই অফারটি এখন পাওয়া যাচ্ছে না।</p>;
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 rounded-xl border border-white/10 bg-gd-night/60 p-3">
        <Pic src={image} alt={product.name} className="h-20 w-20 shrink-0 rounded-lg bg-gd-navy object-cover" />
        <div className="min-w-0">
          <p className="font-display text-lg font-bold leading-tight">{product.name}</p>
          {variantName ? <p className="text-sm leading-snug text-gd-mist">{variantName}</p> : null}
          <p className="mt-1 flex items-baseline gap-2">
            <span className="font-display text-xl font-bold text-gd-cyan">{money(price, currency)}</span>
            {compareAt && compareAt > price ? <span className="text-sm text-gd-mist line-through">{money(compareAt, currency)}</span> : null}
          </p>
        </div>
      </div>
      {product.variants.length > 1 ? (
        <fieldset>
          <legend className="mb-1.5 block font-medium text-gd-ice">রং বাছুন</legend>
          <Swatches s={hero} />
        </fieldset>
      ) : null}
      <div className="flex items-center justify-between gap-4">
        <span className="font-medium text-gd-ice">পরিমাণ</span>
        <QuantityStepper
          value={quantity}
          onChange={(next) => line && setQuantity(next)}
          skin={{
            box: 'flex h-12 items-center overflow-hidden rounded-xl border border-white/15',
            button: 'h-full w-12 text-2xl text-gd-cyan hover:bg-white/10 disabled:opacity-35 disabled:hover:bg-transparent',
            value: 'min-w-[44px] text-center font-display text-xl font-semibold',
          }}
        />
      </div>
    </div>
  );
}

function Order({ s }: { s: S }) {
  return (
    <section data-section="order" className="relative overflow-hidden border-t border-gd-cyan/30 bg-gd-navy py-14 md:py-24">
      <div className="absolute left-1/2 top-0 h-[200px] w-[420px] -translate-x-1/2 rounded-full bg-gd-cyan/20 blur-[90px]" aria-hidden="true" />
      <div className={`relative ${WRAP}`}>
        <div className="mx-auto max-w-2xl">
          <div className="mb-8 text-center">
            {asText(s.eyebrow) ? <p className={EYEBROW}>{asText(s.eyebrow)}</p> : null}
            <h2 className={H2}>{asText(s.title)}</h2>
            {asText(s.subtitle) ? <p className="mt-2 text-gd-mist">{asText(s.subtitle)}</p> : null}
            {s.showTimer !== false ? (
              <div className="mt-4">
                <TimerCells skin={TIMER} />
              </div>
            ) : null}
          </div>
          <LandingOrderForm
            showSavings
            skin={ORDER_SKIN}
            texts={{ buttonLabel: asText(s.buttonLabel) || 'অর্ডার কনফার্ম করুন', note: asText(s.note), successText: asText(s.successText) }}
            products={<ProductBox />}
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
    <footer data-section="footer" className="border-t border-white/10 bg-gd-night pb-28 pt-12 md:pb-10">
      <div className={WRAP}>
        <div className="grid items-center gap-8 md:grid-cols-2">
          <div>
            <p className="font-display text-2xl font-bold">{brand}</p>
            {asText(s.text) ? <p className="mt-2 max-w-sm leading-snug text-gd-mist">{asText(s.text)}</p> : null}
          </div>
          <div className="space-y-3 md:text-right">
            {phone ? (
              <a href={`tel:${phone.replace(/[^\d+]/g, '')}`} className="inline-flex min-h-[44px] items-center gap-2 text-lg">
                <LpIcon name="phone" className="h-5 w-5 text-gd-cyan" strokeWidth={1.6} />
                {phone}
              </a>
            ) : null}
            {facebook ? (
              <div>
                <a href={facebook} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-white/20 px-4 transition-colors hover:border-gd-cyan hover:text-gd-cyan">
                  <LpIcon name="facebook" className="h-5 w-5" strokeWidth={1.6} />
                  Facebook পেজ
                </a>
              </div>
            ) : null}
          </div>
        </div>
        <p className="mt-10 border-t border-white/10 pt-5 text-xs text-gd-mist/70">
          © {new Date().getFullYear()} {brand}। সর্বস্বত্ব সংরক্ষিত।
        </p>
      </div>
    </footer>
  );
}

function StickyBar() {
  const { scrollTo, currency } = useLanding();
  const show = useStickyBar();
  const { price, compareAt, variantName, quantity } = useMainLine();
  const off = discountPercent(price, compareAt);
  return (
    <div
      aria-hidden={!show}
      className={`fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-3 border-t border-gd-cyan/30 bg-gd-navy/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur transition-transform duration-300 md:hidden ${show ? 'translate-y-0' : 'invisible translate-y-full'}`}
    >
      <div className="leading-tight">
        <div className="font-display text-2xl font-bold text-gd-cyan">{money(price * quantity, currency)}</div>
        <div className="text-xs leading-tight text-gd-mist">{[variantName, quantity > 1 ? `${toBn(quantity)}টি` : null, off > 0 ? `${toBn(off)}% ছাড়` : null].filter(Boolean).join(' · ')}</div>
      </div>
      <button type="button" tabIndex={show ? 0 : -1} onClick={() => scrollTo('order')} className={`h-12 rounded-xl bg-gd-cyan px-7 font-display font-bold text-gd-night ${GLOW}`}>
        অর্ডার করুন
      </button>
    </div>
  );
}

const SECTIONS: Record<string, (props: { s: S }) => ReactNode> = {
  hero: Hero,
  highlights: Highlights,
  features: Features,
  specs: Specs,
  in_the_box: InTheBox,
  comparison: Comparison,
  video: Video,
  reviews: Reviews,
  warranty: Warranty,
  faq: Faq,
  order: Order,
  footer: Footer,
};

export function GadgetTemplate() {
  const { content } = useLanding();
  return (
    <div className="bg-gd-night font-sans leading-[1.75] text-gd-ice antialiased">
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
