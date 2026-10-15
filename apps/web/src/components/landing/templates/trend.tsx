'use client';

import { useRef, type ReactNode } from 'react';
import type { LandingValue } from '@ecomesta/utils';
import { FaqList, LazyVideo, LpIcon, Pic, Reveal, Stars, useStickyBar } from '../landing-bits';
import { asItems, asText, itemText, money, toBn, useLanding } from '../landing-context';
import { TimerCells, axisOf, cells, findVariant, swatchFor, swatchHex, useMainLine, variantAxes } from '../landing-kit';
import { LandingOrderForm, type OrderSkin } from '../landing-order-form';
import { QuantityStepper } from '../landing-pickers';

type S = Record<string, LandingValue>;

const WRAP = 'mx-auto w-full max-w-6xl px-5 md:px-10';
const ACID_BTN = 'lp-tr-hard lp-tr-press inline-flex items-center justify-center border-4 border-tr-ink bg-tr-acid font-display font-extrabold uppercase tracking-wide text-tr-ink focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-tr-ink';
const LABEL = 'mb-3 block text-sm font-extrabold uppercase tracking-wide';

const ORDER_SKIN: OrderSkin = {
  form: 'lp-tr-hard space-y-6 border-4 border-tr-ink bg-white p-5 md:p-8',
  label: 'mb-1.5 block text-sm font-extrabold uppercase tracking-wide',
  input: 'h-12 w-full border-4 border-tr-ink bg-tr-bone px-4 text-base font-semibold placeholder:text-tr-mute/70 focus:bg-white focus:outline-none focus:ring-4 focus:ring-tr-acid',
  inputInvalid: 'border-tr-bad',
  select: 'h-12 w-full border-4 border-tr-ink bg-tr-bone px-3 text-base font-semibold focus:outline-none focus:ring-4 focus:ring-tr-acid disabled:opacity-60',
  error: 'mt-1 text-sm font-bold text-tr-bad',
  choice: 'flex cursor-pointer items-center gap-3 border-4 border-tr-ink bg-white p-3 has-[:checked]:bg-tr-acid has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-tr-ink',
  choiceTitle: 'block font-extrabold',
  choiceHint: 'block text-sm font-semibold text-tr-mute',
  choicePrice: 'font-display text-lg',
  radio: 'h-4 w-4 accent-[rgb(var(--tr-ink))]',
  summary: 'space-y-2 border-4 border-tr-ink bg-tr-bone p-5 font-semibold',
  summaryLabel: 'text-tr-mute',
  summaryValue: '',
  totalLabel: 'font-extrabold uppercase',
  totalValue: 'font-display text-4xl',
  divider: 'mt-3 border-t-4 border-tr-ink pt-1',
  savingValue: 'bg-tr-acid px-1 font-extrabold',
  formError: 'mb-3 text-center text-sm font-bold text-tr-bad',
  button: `${ACID_BTN} h-16 w-full text-2xl disabled:opacity-60`,
  note: 'mt-3 text-center text-sm font-semibold text-tr-mute',
  success: {
    box: 'lp-tr-hard border-4 border-tr-ink bg-tr-acid p-8 text-center focus:outline-none',
    icon: 'mx-auto flex h-16 w-16 items-center justify-center border-4 border-tr-ink bg-white text-tr-ink',
    title: 'mt-4 font-display text-5xl uppercase',
    text: 'mt-3 text-lg font-bold',
    total: 'mt-2 font-extrabold',
    link: 'mt-6 inline-flex h-11 items-center border-4 border-tr-ink bg-white px-6 font-extrabold uppercase',
  },
};

function ScrollButton({ label, className = '', hero, target = 'order' }: { label: string; className?: string; hero?: boolean; target?: string }) {
  const { scrollTo } = useLanding();
  if (!label) return null;
  return (
    <button type="button" data-hero-cta={hero ? '' : undefined} onClick={() => scrollTo(target)} className={`${ACID_BTN} ${className}`}>
      {label}
    </button>
  );
}

/** Small tag + huge uppercase heading (the design's section header). */
function Header({ tag, title, subtitle, dark }: { tag: string; title: string; subtitle?: string; dark?: boolean }) {
  return (
    <Reveal>
      {tag ? (
        <p className={`inline-block -rotate-2 border-2 bg-tr-acid px-2.5 py-0.5 text-xs font-extrabold uppercase tracking-[0.18em] text-tr-ink ${dark ? 'border-tr-acid' : 'border-tr-ink'}`}>{tag}</p>
      ) : null}
      <h2 className={`mt-3 max-w-3xl font-display text-[3.4rem] uppercase leading-[0.9] md:text-8xl ${dark ? 'text-tr-bone' : 'text-tr-ink'}`}>{title}</h2>
      {subtitle ? <p className={`mt-3 text-lg font-bold md:text-xl ${dark ? 'text-tr-bone/80' : 'text-tr-mute'}`}>{subtitle}</p> : null}
    </Reveal>
  );
}

/** Colour and size pickers from variant names like "Black / L" (or plain variant buttons). */
function Pickers({ swatches }: { swatches: LandingValue | undefined }) {
  const { product, variantId, variantName, setVariant } = useMainLine();
  const { scrollTo } = useLanding();
  if (!product || product.variants.length < 2) return null;
  const axes = variantAxes(product);
  if (!axes) {
    return (
      <div className="flex flex-wrap gap-2.5" role="group" aria-label="বাছুন">
        {product.variants.map((v) => (
          <button
            key={v.id}
            type="button"
            aria-pressed={v.id === variantId}
            disabled={!v.available}
            onClick={() => setVariant(v.id)}
            className={`h-12 min-w-[3.5rem] border-4 border-tr-ink px-3 font-display text-xl transition disabled:opacity-30 ${v.id === variantId ? 'bg-tr-ink text-tr-acid' : 'bg-white text-tr-ink'}`}
          >
            {v.name}
          </button>
        ))}
      </div>
    );
  }
  const color = axisOf(variantName, 0);
  const size = axisOf(variantName, 1);
  const pick = (c: string, z: string) => {
    const v = findVariant(product, c, z);
    if (v) setVariant(v.id);
  };
  const sizeAvailable = (z: string) => product.variants.some((v) => axisOf(v.name, 0) === color && axisOf(v.name, 1) === z && v.available);
  return (
    <div className="space-y-6">
      <div>
        <p className={LABEL}>
          কালার: <b className="bg-tr-acid px-1.5">{color}</b>
        </p>
        <div className="flex flex-wrap gap-3" role="group" aria-label="কালার বাছুন">
          {axes.first.map((c) => {
            const hex = swatchHex(swatchFor(swatches, c));
            const active = c === color;
            return hex ? (
              <button
                key={c}
                type="button"
                aria-label={c}
                title={c}
                aria-pressed={active}
                onClick={() => pick(c, size)}
                className={`relative h-12 w-12 rounded-full border-4 border-tr-ink transition focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-tr-ink ${active ? 'ring-4 ring-tr-acid ring-offset-2 ring-offset-tr-ink' : ''}`}
                style={{ background: hex }}
              >
                {active ? <LpIcon name="check" className="absolute inset-0 m-auto h-5 w-5 text-white mix-blend-difference" strokeWidth={3} /> : null}
              </button>
            ) : (
              <button
                key={c}
                type="button"
                aria-pressed={active}
                onClick={() => pick(c, size)}
                className={`h-12 border-4 border-tr-ink px-3 font-extrabold uppercase ${active ? 'bg-tr-ink text-tr-acid' : 'bg-white'}`}
              >
                {c}
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <p className={LABEL}>
          সাইজ: <b className="bg-tr-acid px-1.5">{size}</b>{' '}
          <button type="button" onClick={() => scrollTo('size_guide')} className="ml-2 font-semibold normal-case tracking-normal text-tr-mute underline underline-offset-2">
            সাইজ চার্ট
          </button>
        </p>
        <div className="flex flex-wrap gap-2.5" role="group" aria-label="সাইজ বাছুন">
          {axes.second.map((z) => (
            <button
              key={z}
              type="button"
              aria-pressed={z === size}
              disabled={!sizeAvailable(z)}
              onClick={() => pick(color, z)}
              className={`h-12 min-w-[3.5rem] border-4 border-tr-ink px-3 font-display text-xl transition disabled:opacity-30 disabled:line-through ${z === size ? 'bg-tr-ink text-tr-acid' : 'bg-white text-tr-ink'}`}
            >
              {z}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function useProductImage(hero: S | undefined) {
  const { product, variantName } = useMainLine();
  const swatch = swatchFor(hero?.swatches, axisOf(variantName, 0));
  return (swatch && itemText(swatch, 'imageUrl')) || asText(hero?.imageUrl) || product?.imageUrl || '';
}

function Marquee({ s }: { s: S }) {
  const items = asItems(s.items).map((i) => itemText(i, 'text')).filter(Boolean);
  if (items.length === 0) return null;
  const group = (hidden: boolean) => (
    <div className="flex shrink-0" aria-hidden={hidden || undefined}>
      {items.map((t, i) => (
        <span key={i} className="inline-flex items-center gap-6 whitespace-nowrap pr-6 font-display text-lg uppercase tracking-wide md:text-2xl">
          {t}
          <span aria-hidden="true">✺</span>
        </span>
      ))}
    </div>
  );
  return (
    <section data-section="marquee" className="overflow-hidden border-b-4 border-tr-ink bg-tr-acid text-tr-ink" aria-label={items.join(' · ')}>
      <div className="lp-tr-marquee flex w-max py-2.5">
        {group(false)}
        {group(true)}
      </div>
    </section>
  );
}

function Hero({ s }: { s: S }) {
  const { brand, scrollTo, settings, currency } = useLanding();
  const { product, price, compareAt } = useMainLine();
  const image = useProductImage(s);
  const drop = settings('drop');
  const left = Number(drop?.stockLeft) || 0;
  const save = compareAt && compareAt > price ? compareAt - price : 0;
  return (
    <section data-section="hero" className="lp-tr-dots relative overflow-hidden bg-tr-bone">
      <div className={WRAP}>
        <div className="flex items-center justify-between py-5">
          <span className="-rotate-2 bg-tr-ink px-3 font-display text-3xl uppercase leading-tight tracking-wide text-tr-acid">{asText(s.brand) || brand}</span>
          <button type="button" onClick={() => scrollTo('order')} className="py-2 text-sm font-extrabold uppercase underline decoration-tr-acid decoration-4 underline-offset-4">
            অর্ডার
          </button>
        </div>
        <div className="grid gap-8 pb-14 md:grid-cols-12 md:gap-x-12 md:pb-24">
          <div className="md:col-span-7 md:row-start-1">
            {asText(s.badge) ? <p className="inline-flex rotate-1 items-center gap-2 bg-tr-ink px-3 py-1 text-sm font-extrabold uppercase tracking-widest text-tr-acid">{asText(s.badge)}</p> : null}
            <h1 className="mt-4 font-display text-[min(21.5vw,6rem)] uppercase leading-[0.88] md:text-[7rem] lg:text-[8rem]">
              <span className="block">{asText(s.titleLine1)}</span>
              <span className="block">
                {asText(s.titleLine2)}
                {asText(s.titleTag) ? (
                  <span className="lp-tr-hard-sm ml-2 inline-block -rotate-3 border-4 border-tr-ink bg-tr-acid px-2 align-middle text-[0.45em] leading-tight">{asText(s.titleTag)}</span>
                ) : null}
              </span>
            </h1>
            {asText(s.subtitle) ? <p className="mt-5 max-w-md text-xl font-bold leading-snug md:text-2xl">{asText(s.subtitle)}</p> : null}
          </div>
          <div className="relative mx-1 md:col-span-5 md:col-start-8 md:row-span-2 md:row-start-1 md:mx-0 md:self-center">
            <div className="lp-tr-hard relative -rotate-2 border-4 border-tr-ink bg-white">
              <Pic src={image} alt={product?.name ?? ''} eager className="aspect-[4/5] w-full object-cover" />
              {asText(s.sticker) ? (
                <span className="lp-tr-hard-sm absolute -right-3 -top-4 rotate-12 border-4 border-tr-ink bg-tr-acid px-3 py-1.5 font-display text-xl uppercase">{asText(s.sticker)}</span>
              ) : null}
              {asText(s.stamp) ? (
                <span className="absolute -bottom-4 -left-3 -rotate-6 border-4 border-tr-acid bg-tr-ink px-3 py-1 font-display text-lg uppercase tracking-wider text-tr-acid">{asText(s.stamp)}</span>
              ) : null}
            </div>
          </div>
          <div className="lp-tr-hard border-4 border-tr-ink bg-white p-5 md:col-span-7 md:col-start-1 md:row-start-2 md:p-8">
            {product ? (
              <p className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <span className="font-display text-6xl leading-none md:text-7xl">{money(price, currency)}</span>
                {save > 0 ? <span className="text-2xl font-bold text-tr-mute line-through">{money(compareAt!, currency)}</span> : null}
                {save > 0 ? <span className="-rotate-2 border-2 border-tr-ink bg-tr-acid px-2 text-sm font-extrabold">{money(save, currency)} সাশ্রয়</span> : null}
              </p>
            ) : null}
            <div className="mt-5">
              <Pickers swatches={s.swatches} />
            </div>
            <ScrollButton label={asText(s.buttonLabel)} hero className="mt-7 h-16 w-full text-2xl" />
            <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-bold">
              {left > 0 ? <span>🔥 মাত্র {toBn(left)}টা বাকি</span> : null}
              {asText(s.note) ? <span>{asText(s.note)}</span> : null}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Drop({ s }: { s: S }) {
  const left = Number(s.stockLeft) || 0;
  const total = Number(s.stockTotal) || 0;
  const pct = total > 0 ? Math.max(0, Math.min(100, Math.round((left / total) * 100))) : 0;
  return (
    <section data-section="drop" className="lp-tr-dots-light overflow-hidden border-y-4 border-tr-ink bg-tr-ink py-14 text-tr-bone md:py-24">
      <div className={WRAP}>
        <div className="grid items-center gap-10 md:grid-cols-2 md:gap-16">
          <div>
            <Header tag={asText(s.tag)} title={asText(s.title)} subtitle={asText(s.text)} dark />
            <div className="mt-8">
              <TimerCells
                ariaLabel="ড্রপ শেষ হতে বাকি সময়"
                skin={{
                  box: 'flex gap-2 md:gap-3',
                  cell: 'min-w-[64px] border-4 border-tr-acid bg-tr-ink px-2 py-2 text-center md:min-w-[96px]',
                  value: 'font-display text-4xl leading-none text-tr-acid md:text-6xl',
                  label: 'mt-1 text-[11px] font-bold uppercase tracking-wider text-tr-bone md:text-sm',
                }}
              />
            </div>
          </div>
          {total > 0 ? (
            <Reveal className="lp-tr-hard-acid -rotate-1 border-4 border-tr-acid bg-tr-ink p-5 md:p-8">
              <p className="font-display text-5xl uppercase leading-tight text-tr-acid md:text-6xl">মাত্র {toBn(left)}টা বাকি</p>
              <p className="mt-2 font-bold text-tr-bone/80">মোট {toBn(total)}টার মধ্যে</p>
              <div className="mt-5 h-9 border-4 border-tr-acid p-1" role="progressbar" aria-label="স্টক বাকি" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
                <div className="h-full bg-tr-acid" style={{ width: `${pct}%` }} />
              </div>
              <ScrollButton label={asText(s.buttonLabel)} className="mt-6 h-14 w-full border-tr-acid text-xl shadow-none" />
            </Reveal>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function Reels({ s }: { s: S }) {
  const track = useRef<HTMLDivElement>(null);
  const items = asItems(s.items).filter((i) => itemText(i, 'posterUrl') || itemText(i, 'videoUrl'));
  const scroll = (dir: number) => track.current?.scrollBy({ left: dir * 270, behavior: 'smooth' });
  return (
    <section data-section="reels" className="overflow-hidden py-14 md:py-24">
      <div className={WRAP}>
        <div className="flex items-end justify-between gap-4">
          <Header tag={asText(s.tag)} title={asText(s.title)} subtitle={asText(s.subtitle)} />
          <div className="hidden shrink-0 gap-3 md:flex">
            <button type="button" onClick={() => scroll(-1)} aria-label="আগের ভিডিও" className="lp-tr-hard-sm flex h-14 w-14 items-center justify-center border-4 border-tr-ink bg-white hover:bg-tr-acid">
              <LpIcon name="left" className="h-6 w-6" />
            </button>
            <button type="button" onClick={() => scroll(1)} aria-label="পরের ভিডিও" className="lp-tr-hard-sm flex h-14 w-14 items-center justify-center border-4 border-tr-ink bg-white hover:bg-tr-acid">
              <LpIcon name="right" className="h-6 w-6" />
            </button>
          </div>
        </div>
        <div ref={track} tabIndex={0} aria-label="কাস্টমার রিলস, সোয়াইপ করুন" className="lp-tr-noscroll -mx-5 mt-10 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-8 pt-2 md:-mx-3 md:px-3">
          {items.map((reel, i) => (
            <figure key={i} className={`w-[62vw] max-w-[250px] shrink-0 snap-start md:w-[250px] ${i % 2 ? 'rotate-1' : '-rotate-1'}`}>
              <LazyVideo
                url={itemText(reel, 'videoUrl')}
                poster={itemText(reel, 'posterUrl')}
                aspect="aspect-[9/16]"
                label={`${itemText(reel, 'handle')} এর ভিডিও চালান`}
                className="lp-tr-hard border-4 border-tr-ink bg-tr-ink"
                buttonClass="lp-tr-hard-sm flex h-16 w-16 items-center justify-center rounded-full border-4 border-tr-ink bg-tr-acid text-tr-ink"
                iconClass="ml-0.5 h-7 w-7"
                noteClass="absolute inset-x-2 bottom-2 border-2 border-tr-ink bg-white px-2 py-1.5 text-xs font-bold leading-snug text-tr-bad"
              />
              <figcaption className="mt-3 leading-tight">
                {itemText(reel, 'handle') ? <b className="bg-tr-acid px-1.5 font-extrabold">{itemText(reel, 'handle')}</b> : null}
                {itemText(reel, 'caption') ? <span className="mt-1 block text-sm font-semibold text-tr-mute">{itemText(reel, 'caption')}</span> : null}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

const TILTS = ['-rotate-3', 'rotate-2', 'rotate-3', '-rotate-2', '-rotate-1', 'rotate-3'];

function Styles({ s }: { s: S }) {
  return (
    <section data-section="styles" className="overflow-hidden border-y-4 border-tr-ink bg-tr-acid py-14 md:py-24">
      <div className={WRAP}>
        <Header tag={asText(s.tag)} title={asText(s.title)} subtitle={asText(s.subtitle)} />
        <div className="mt-12 grid grid-cols-2 gap-x-4 gap-y-10 md:gap-x-10 md:gap-y-14 lg:grid-cols-3">
          {asItems(s.items).map((item, i) => (
            <Reveal as="figure" key={i} className={`lp-tr-hard border-4 border-tr-ink bg-white p-2 pb-3 md:p-3 ${TILTS[i % TILTS.length]}`}>
              <Pic src={itemText(item, 'imageUrl')} alt={`${itemText(item, 'name')} লুক`} className="aspect-[5/6] w-full border-2 border-tr-ink object-cover" />
              <figcaption className="mt-2.5 leading-tight">
                <span className="block font-display text-xl uppercase md:text-3xl">{itemText(item, 'name')}</span>
                <span className="block text-sm font-semibold text-tr-mute md:text-base">{itemText(item, 'text')}</span>
              </figcaption>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Details({ s }: { s: S }) {
  return (
    <section data-section="details" className="lp-tr-dots-light bg-tr-ink py-14 text-tr-bone md:py-24">
      <div className={WRAP}>
        <div className="grid items-start gap-10 md:grid-cols-12">
          <div className="md:col-span-5">
            <Header tag={asText(s.tag)} title={asText(s.title)} subtitle={asText(s.subtitle)} dark />
            {asText(s.modelNote) ? <p className="mt-6 border-4 border-tr-acid p-4 font-semibold leading-snug">{asText(s.modelNote)}</p> : null}
          </div>
          <div className="grid gap-4 sm:grid-cols-2 md:col-span-7">
            {asItems(s.items).map((item, i) => (
              <Reveal key={i} className={`border-4 border-tr-acid p-4 text-tr-ink ${i % 3 === 0 ? 'bg-tr-acid' : 'bg-white'} ${i % 2 ? 'sm:rotate-1' : 'sm:-rotate-1'}`}>
                <p className="text-xs font-extrabold uppercase tracking-[0.2em]">{itemText(item, 'label')}</p>
                <p className="mt-1 font-display text-2xl uppercase leading-tight md:text-3xl">{itemText(item, 'value')}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function SizeGuide({ s }: { s: S }) {
  const { scrollTo } = useLanding();
  const { product, variantName, setVariant } = useMainLine();
  const columns = cells(asText(s.columns));
  const color = axisOf(variantName, 0);
  const pickSize = (size: string) => {
    if (!product) return;
    const axes = variantAxes(product);
    const v = axes ? findVariant(product, color, size) : product.variants.find((x) => x.name === size);
    if (v) setVariant(v.id);
    scrollTo('order');
  };
  return (
    <section data-section="size_guide" className="py-14 md:py-24">
      <div className={WRAP}>
        <Header tag={asText(s.tag)} title={asText(s.title)} subtitle={asText(s.subtitle)} />
        <Reveal className="lp-tr-hard relative mt-10 overflow-x-auto border-4 border-tr-ink bg-white">
          <table className="w-full min-w-[520px] text-center">
            <thead className="bg-tr-ink text-tr-acid">
              <tr className="font-display text-lg uppercase tracking-wide md:text-xl">
                <th scope="col" className="px-3 py-3 font-normal">
                  Size
                </th>
                {columns.map((c, i) => (
                  <th key={i} scope="col" className="px-3 py-3 font-normal">
                    {c}
                  </th>
                ))}
                <th scope="col" className="px-3 py-3 font-normal">
                  <span className="sr-only">সাইজ বাছুন</span>
                </th>
              </tr>
            </thead>
            <tbody className="font-bold">
              {asItems(s.rows).map((row, i) => (
                <tr key={i} className={`border-t-4 border-tr-ink ${i % 2 ? 'bg-tr-bone' : ''}`}>
                  <th scope="row" className="border-r-4 border-tr-ink bg-tr-acid px-3 py-3 font-display text-2xl font-normal">
                    {itemText(row, 'size')}
                  </th>
                  {cells(itemText(row, 'values')).map((v, j) => (
                    <td key={j} className="px-3 py-3">
                      {v}
                    </td>
                  ))}
                  <td className="px-3 py-2">
                    <button type="button" onClick={() => pickSize(itemText(row, 'size'))} className="h-10 whitespace-nowrap border-4 border-tr-ink bg-white px-4 text-sm font-extrabold hover:bg-tr-acid">
                      {itemText(row, 'size')} নিন
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Reveal>
        {asText(s.tip) ? <p className="mt-5 max-w-xl font-semibold">{asText(s.tip)}</p> : null}
      </div>
    </section>
  );
}

function SocialProof({ s }: { s: S }) {
  const shots = asItems(s.screenshots).filter((i) => itemText(i, 'imageUrl'));
  return (
    <section data-section="social_proof" className="overflow-hidden border-y-4 border-tr-ink bg-tr-ink py-14 text-tr-bone md:py-24">
      <div className={WRAP}>
        <Header tag={asText(s.tag)} title={asText(s.title)} dark />
        <div className="mt-10 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {asItems(s.stats).map((stat, i) => (
            <Reveal key={i} className={`border-4 border-tr-acid p-4 md:p-6 ${i % 2 ? 'rotate-1 bg-tr-acid text-tr-ink' : '-rotate-1'}`}>
              <p className={`font-display text-5xl leading-none md:text-7xl ${i % 2 ? '' : 'text-tr-acid'}`}>{itemText(stat, 'value')}</p>
              <p className="mt-2 text-sm font-extrabold uppercase tracking-wide md:text-base">{itemText(stat, 'label')}</p>
            </Reveal>
          ))}
        </div>
        {shots.length > 0 ? (
          <div className="mx-auto mt-12 grid max-w-3xl grid-cols-3 gap-3 md:gap-8">
            {shots.map((shot, i) => (
              <Reveal as="figure" key={i} className={`border-4 border-tr-acid bg-tr-bone p-1.5 ${TILTS[i % TILTS.length]}`}>
                <Pic src={itemText(shot, 'imageUrl')} alt={`কাস্টমারের মেসেজ স্ক্রিনশট ${toBn(i + 1)}`} className="aspect-[1/2] w-full object-cover object-top" />
              </Reveal>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function Reviews({ s }: { s: S }) {
  return (
    <section data-section="reviews" className="overflow-hidden py-14 md:py-24">
      <div className={WRAP}>
        <Header tag={asText(s.tag)} title={asText(s.title)} subtitle={asText(s.subtitle)} />
        <div className="mt-12 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {asItems(s.items).map((review, i) => (
            <Reveal as="figure" key={i} className={`lp-tr-hard flex flex-col border-4 border-tr-ink bg-white ${i % 3 === 1 ? 'rotate-1' : '-rotate-1'}`}>
              {itemText(review, 'imageUrl') ? <Pic src={itemText(review, 'imageUrl')} alt={`${itemText(review, 'name')} এর ছবি`} className="aspect-[4/3] w-full border-b-4 border-tr-ink object-cover" /> : null}
              <div className="flex flex-1 flex-col p-4">
                <span className="flex self-start border-2 border-tr-ink bg-tr-acid px-1.5 py-0.5">
                  <Stars rating={Number(review.rating)} className="h-5 w-5" />
                </span>
                <blockquote className="mt-3 flex-1 font-semibold leading-snug">“{itemText(review, 'text')}”</blockquote>
                <figcaption className="mt-3 text-sm">
                  <b className="font-extrabold">{itemText(review, 'name')}</b>
                  {itemText(review, 'location') ? `, ${itemText(review, 'location')}` : ''}{' '}
                  {itemText(review, 'size') ? <span className="ml-1 bg-tr-ink px-1.5 font-display tracking-wide text-tr-acid">SIZE {itemText(review, 'size')}</span> : null}
                </figcaption>
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
    <section data-section="faq" className="border-y-4 border-tr-ink bg-tr-acid py-14 md:py-24">
      <div className={WRAP}>
        <div className="mx-auto max-w-3xl">
          <Header tag={asText(s.tag)} title={asText(s.title)} />
          <div className="mt-10 space-y-4">
            <FaqList
              items={asItems(s.items)}
              skin={{
                item: 'lp-tr-hard-sm border-4 border-tr-ink bg-white',
                button: 'flex min-h-[64px] w-full items-center justify-between gap-4 px-4 py-4 text-left md:px-5',
                question: 'text-lg font-extrabold leading-snug',
                panel: 'border-t-4 border-tr-ink px-4 pb-5 pt-4 font-semibold leading-relaxed md:px-5',
                chevron: 'h-9 w-9 bg-tr-ink p-2 text-tr-acid',
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
  const hero = settings('hero');
  const { product, price, compareAt, variantName, quantity, setQuantity, line } = useMainLine();
  const image = useProductImage(hero);
  if (!product) return <p className="py-6 text-center font-bold text-tr-mute">এই ড্রপটি এখন পাওয়া যাচ্ছে না।</p>;
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 border-4 border-tr-ink bg-tr-bone p-3">
        <Pic src={image} alt={product.name} className="h-20 w-20 shrink-0 border-2 border-tr-ink object-cover" />
        <div className="min-w-0">
          <p className="font-display text-xl uppercase leading-tight">{product.name}</p>
          {variantName ? <p className="text-sm font-bold text-tr-mute">{variantName}</p> : null}
          <p className="mt-1 flex items-baseline gap-2">
            <span className="font-display text-2xl">{money(price, currency)}</span>
            {compareAt && compareAt > price ? <span className="text-sm font-bold text-tr-mute line-through">{money(compareAt, currency)}</span> : null}
          </p>
        </div>
      </div>
      <Pickers swatches={hero?.swatches} />
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm font-extrabold uppercase tracking-wide">পরিমাণ</span>
        <QuantityStepper
          value={quantity}
          onChange={(next) => line && setQuantity(next)}
          skin={{
            box: 'flex h-12 items-center border-4 border-tr-ink bg-white',
            button: 'h-full w-12 text-2xl font-extrabold hover:bg-tr-acid disabled:opacity-35 disabled:hover:bg-transparent',
            value: 'min-w-[44px] text-center font-display text-2xl',
          }}
        />
      </div>
    </div>
  );
}

function Order({ s }: { s: S }) {
  return (
    <section data-section="order" className="lp-tr-dots bg-tr-bone py-14 md:py-24">
      <div className={WRAP}>
        <div className="mx-auto max-w-2xl">
          <div className="mb-8">
            <Header tag={asText(s.tag)} title={asText(s.title)} subtitle={asText(s.subtitle)} />
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
  const links = [
    { url: asText(s.facebookUrl), icon: 'facebook', label: 'Facebook' },
    { url: asText(s.instagramUrl), icon: 'instagram', label: 'Instagram' },
    { url: asText(s.tiktokUrl), icon: 'tiktok', label: 'TikTok' },
  ].filter((l) => l.url);
  return (
    <footer data-section="footer" className="border-t-4 border-tr-ink bg-tr-ink text-tr-bone">
      <div className={`${WRAP} pb-28 pt-12 md:pb-10`}>
        <div className="grid items-center gap-8 md:grid-cols-2">
          <div>
            <p className="inline-block -rotate-2 bg-tr-acid px-3 font-display text-4xl uppercase text-tr-ink">{brand}</p>
            {asText(s.text) ? <p className="mt-4 max-w-sm font-semibold leading-snug text-tr-bone/70">{asText(s.text)}</p> : null}
          </div>
          <div className="space-y-3 md:text-right">
            {phone ? (
              <a href={`tel:${phone.replace(/[^\d+]/g, '')}`} className="inline-flex min-h-[44px] items-center gap-2 text-lg font-bold">
                <LpIcon name="phone" className="h-5 w-5" />
                {phone}
              </a>
            ) : null}
            {links.length > 0 ? (
              <div className="flex gap-2 md:justify-end">
                {links.map((l) => (
                  <a key={l.icon} href={l.url} target="_blank" rel="noopener noreferrer" aria-label={l.label} className="flex h-12 w-12 items-center justify-center border-4 border-tr-acid text-tr-acid transition-colors hover:bg-tr-acid hover:text-tr-ink">
                    <LpIcon name={l.icon} className="h-5 w-5" />
                  </a>
                ))}
              </div>
            ) : null}
          </div>
        </div>
        <p className="mt-10 border-t-2 border-tr-bone/15 pt-5 text-xs font-semibold text-tr-bone/50">
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
      className={`fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-3 border-t-4 border-tr-ink bg-tr-acid px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] transition-transform duration-300 md:hidden ${show ? 'translate-y-0' : 'invisible translate-y-full'}`}
    >
      <div className="leading-tight">
        <div className="font-display text-3xl">{money(price * quantity, currency)}</div>
        <div className="text-xs font-bold leading-tight">{[variantName, quantity > 1 ? `${toBn(quantity)}টি` : null].filter(Boolean).join(' · ')}</div>
      </div>
      <button type="button" tabIndex={show ? 0 : -1} onClick={() => scrollTo('order')} className="h-12 border-4 border-tr-ink bg-tr-ink px-6 font-display text-xl uppercase text-tr-acid">
        অর্ডার করুন
      </button>
    </div>
  );
}

const SECTIONS: Record<string, (props: { s: S }) => ReactNode> = {
  marquee: Marquee,
  hero: Hero,
  drop: Drop,
  reels: Reels,
  styles: Styles,
  details: Details,
  size_guide: SizeGuide,
  social_proof: SocialProof,
  reviews: Reviews,
  faq: Faq,
  order: Order,
  footer: Footer,
};

export function TrendTemplate() {
  const { content } = useLanding();
  return (
    <div className="bg-tr-bone font-sans leading-[1.6] text-tr-ink antialiased">
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
