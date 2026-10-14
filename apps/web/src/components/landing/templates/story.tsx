'use client';

import { useEffect, useState, type ReactNode } from 'react';
import type { LandingValue } from '@ecomesta/utils';
import { FaqList, LazyVideo, LpIcon, Marked, Paragraphs, Pic, Reveal, Stars, useStickyBar } from '../landing-bits';
import { asItems, asText, itemText, linePrice, money, toBn, useLanding, useTimeLeft, type LandingProduct } from '../landing-context';
import { LandingOrderForm, type OrderSkin } from '../landing-order-form';
import { QuantityStepper } from '../landing-pickers';

type S = Record<string, LandingValue>;

const MARK = 'lp-st-mark';
const SQUIG = 'lp-st-squig';
const COL = 'mx-auto w-full max-w-[680px] px-5';
const EYEBROW = 'mb-2 font-display text-sm font-bold tracking-wide text-st-brand';
const H2 = 'font-display text-3xl font-extrabold leading-tight md:text-4xl';
const BTN =
  'inline-flex h-14 w-full items-center justify-center rounded-xl bg-st-brand px-6 font-display text-xl font-bold text-white shadow-lg shadow-st-brand/25 transition-colors hover:bg-st-brand-dark';

const ORDER_SKIN: OrderSkin = {
  form: 'mt-7 space-y-6 rounded-2xl bg-white p-5 shadow-sm md:p-8',
  label: 'mb-1.5 block font-display text-lg font-bold',
  input: 'h-12 w-full rounded-xl border-2 border-st-line bg-white px-4 text-base placeholder:text-st-ink/40 focus:border-st-brand focus:outline-none focus:ring-2 focus:ring-st-brand/20',
  inputInvalid: 'border-st-bad',
  select: 'h-12 w-full rounded-xl border-2 border-st-line bg-white px-3 text-base focus:border-st-brand focus:outline-none focus:ring-2 focus:ring-st-brand/20 disabled:opacity-60',
  error: 'mt-1 text-sm text-st-bad',
  choice:
    'flex cursor-pointer items-center gap-3 rounded-xl border-2 border-st-line p-3 leading-snug has-[:checked]:border-st-brand has-[:checked]:bg-st-brand-light has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-st-brand',
  choiceTitle: 'block font-display font-bold',
  choiceHint: 'block text-sm text-st-ink/70',
  choicePrice: 'font-display font-bold',
  radio: 'h-4 w-4 accent-[rgb(var(--st-brand))]',
  summary: 'space-y-2 rounded-xl border border-st-line bg-st-soft p-5 text-base leading-snug',
  summaryLabel: 'text-st-ink/70',
  summaryValue: '',
  totalLabel: 'font-display text-lg font-bold',
  totalValue: 'font-display text-3xl font-extrabold text-st-brand',
  divider: 'mt-3 border-t border-st-line pt-1',
  savingValue: 'font-bold text-st-good',
  formError: 'mb-3 text-center text-sm text-st-bad',
  button: `${BTN} disabled:opacity-60`,
  note: 'mt-3 text-center text-sm text-st-ink/60',
  success: {
    box: 'mt-7 rounded-2xl border-2 border-st-good bg-white p-8 text-center focus:outline-none',
    icon: 'mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-st-good text-white',
    title: 'mt-4 font-display text-4xl font-extrabold',
    text: 'mt-3',
    total: 'mt-2 font-bold text-st-brand',
    link: 'mt-6 inline-flex h-11 items-center rounded-xl border-2 border-st-brand px-6 font-display font-bold text-st-brand hover:bg-st-brand-light',
  },
};

/** The offers: the product's variants (1 pc, 2 pc combo…), or the product itself. */
function offersOf(product: LandingProduct | undefined) {
  if (!product) return [];
  if (product.variants.length === 0) return [{ id: null as string | null, name: product.name, price: product.price, compareAt: product.compareAt, available: product.available }];
  return product.variants.map((v) => ({ id: v.id as string | null, name: v.name, price: v.price, compareAt: v.compareAt, available: v.available }));
}

function Arrow() {
  return (
    <svg viewBox="0 0 56 40" className="mx-auto h-10 w-14 rotate-[8deg] text-st-brand" aria-hidden="true">
      <path d="M6 4C10 22 24 34 48 30M48 30l-12-9M48 30l-9 10" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Cta({ note, label }: { note?: string; label: string }) {
  const { scrollTo } = useLanding();
  if (!label) return null;
  return (
    <Reveal className="mt-9 text-center">
      {note ? <p className="mb-1 font-display text-base font-semibold text-st-ink/70">{note}</p> : null}
      <Arrow />
      <button type="button" onClick={() => scrollTo('order')} className={`${BTN} mt-1`}>
        {label}
      </button>
    </Reveal>
  );
}

function ReadingProgress() {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const update = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? Math.min(1, window.scrollY / max) : 0);
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);
  return (
    <div className="fixed inset-x-0 top-0 z-40 h-1.5 bg-st-brand-light">
      <div
        role="progressbar"
        aria-label="পড়ার অগ্রগতি"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        className="h-full origin-left bg-st-brand"
        style={{ transform: `scaleX(${progress})` }}
      />
    </div>
  );
}

function Hero({ s }: { s: S }) {
  const { products, scrollTo } = useLanding();
  const image = asText(s.imageUrl) || products[0]?.imageUrl || '';
  return (
    <section data-section="hero" className="pb-12 pt-8 md:pt-14">
      <div className={COL}>
        {asText(s.eyebrow) ? (
          <p className="flex items-center gap-2 font-display font-bold text-st-brand">
            <span className="h-2 w-2 rounded-full bg-st-bad" />
            {asText(s.eyebrow)}
          </p>
        ) : null}
        <h1 className="mt-4 font-display text-4xl font-extrabold leading-[1.2] sm:text-5xl">
          <Marked text={asText(s.title)} markClass={MARK} squiggleClass={SQUIG} />
        </h1>
        {asText(s.subtitle) ? <p className="mt-5 text-xl text-st-ink/80">{asText(s.subtitle)}</p> : null}
        {image ? (
          <div className="relative mt-7">
            <Pic src={image} alt={products[0]?.name ?? ''} eager className="aspect-square w-full rounded-2xl bg-st-brand-light object-cover" />
            {asText(s.badge) ? <span className="absolute -bottom-3 right-3 rotate-[-3deg] rounded-lg bg-st-mark px-4 py-1.5 font-display font-extrabold text-st-ink shadow">{asText(s.badge)}</span> : null}
          </div>
        ) : null}
        {asText(s.customerCount) ? (
          <p className="mt-6 flex items-center gap-2 text-st-ink/70">
            <span style={{ color: '#E0A800' }}>★★★★★</span>
            <span>
              <b className="text-st-ink">{asText(s.customerCount)}</b>+ গ্রাহক ব্যবহার করেছেন
            </span>
          </p>
        ) : null}
        {asText(s.buttonLabel) ? (
          <button type="button" data-hero-cta="" onClick={() => scrollTo('order')} className={`${BTN} mt-5`}>
            {asText(s.buttonLabel)}
          </button>
        ) : null}
        {asText(s.buttonNote) ? <p className="mt-2 text-center text-sm text-st-ink/60">{asText(s.buttonNote)}</p> : null}
      </div>
    </section>
  );
}

function Problem({ s }: { s: S }) {
  return (
    <section data-section="problem" className="bg-st-soft py-14">
      <div className={COL}>
        {asText(s.eyebrow) ? <p className={EYEBROW}>{asText(s.eyebrow)}</p> : null}
        <h2 className={H2}>{asText(s.title)}</h2>
        <Reveal className="mt-6 space-y-5">
          <Paragraphs text={asText(s.text)} markClass={MARK} />
          {asText(s.quote) ? (
            <blockquote className="border-l-4 border-st-brand py-1 pl-4 font-display text-2xl font-bold leading-snug text-st-brand-dark">“{asText(s.quote)}”</blockquote>
          ) : null}
        </Reveal>
      </div>
    </section>
  );
}

function Agitate({ s }: { s: S }) {
  return (
    <section data-section="agitate" className="py-14">
      <div className={COL}>
        {asText(s.eyebrow) ? <p className={EYEBROW}>{asText(s.eyebrow)}</p> : null}
        <h2 className={H2}>{asText(s.title)}</h2>
        <ul className="mt-7 space-y-3">
          {asItems(s.items).map((item, i) => (
            <Reveal key={i} as="li" className="flex gap-3 rounded-xl border border-st-line bg-white p-4">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-st-bad/10 text-st-bad">
                <LpIcon name="x" className="h-4 w-4" strokeWidth={1.8} />
              </span>
              <div className="leading-snug">
                <b className="font-display text-lg">{itemText(item, 'title')}</b>
                <br />
                <span className="text-base text-st-ink/75">{itemText(item, 'text')}</span>
              </div>
            </Reveal>
          ))}
        </ul>
        {asText(s.closing) ? (
          <p className="mt-6">
            <Marked text={asText(s.closing)} markClass={MARK} />
          </p>
        ) : null}
        <Cta note={asText(s.ctaNote)} label={asText(s.buttonLabel)} />
      </div>
    </section>
  );
}

function Solution({ s }: { s: S }) {
  return (
    <section data-section="solution" className="bg-st-brand py-14 text-white">
      <div className={COL}>
        {asText(s.eyebrow) ? <p className="mb-2 font-display text-sm font-bold tracking-wide text-st-mark">{asText(s.eyebrow)}</p> : null}
        <h2 className={H2}>
          <Marked text={asText(s.title)} markClass="bg-transparent text-st-mark" />
        </h2>
        <Pic src={asText(s.imageUrl)} alt={asText(s.title).replace(/==/g, '')} className="mt-7 aspect-[9/7] w-full rounded-2xl bg-st-brand-dark object-cover" />
        {asText(s.text) ? (
          <p className="mt-7 text-white/90">
            <Marked text={asText(s.text)} markClass={`${MARK} text-st-ink`} />
          </p>
        ) : null}
        <ul className="mt-5 space-y-2 text-white/95">
          {asItems(s.points).map((point, i) => (
            <li key={i} className="flex gap-3">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-st-mark text-st-ink">
                <LpIcon name="check" className="h-4 w-4" strokeWidth={1.8} />
              </span>
              {itemText(point, 'text')}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function HowItWorks({ s }: { s: S }) {
  return (
    <section data-section="how_it_works" className="py-14">
      <div className={COL}>
        {asText(s.eyebrow) ? <p className={EYEBROW}>{asText(s.eyebrow)}</p> : null}
        <h2 className={H2}>{asText(s.title)}</h2>
        <ol className="mt-8 space-y-5">
          {asItems(s.steps).map((step, i) => (
            <Reveal key={i} as="li" className="flex items-start gap-4">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-st-brand-light text-st-brand">
                <LpIcon name={itemText(step, 'icon')} className="h-7 w-7" strokeWidth={1.8} />
              </span>
              <div>
                <h3 className="font-display text-xl font-extrabold">{itemText(step, 'title')}</h3>
                <p className="mt-0.5 leading-snug text-st-ink/80">{itemText(step, 'text')}</p>
              </div>
            </Reveal>
          ))}
        </ol>
        <Cta note={asText(s.ctaNote)} label={asText(s.buttonLabel)} />
      </div>
    </section>
  );
}

function Video({ s }: { s: S }) {
  return (
    <section data-section="video" className="bg-st-soft py-14">
      <div className={COL}>
        {asText(s.eyebrow) ? <p className={EYEBROW}>{asText(s.eyebrow)}</p> : null}
        <h2 className={H2}>{asText(s.title)}</h2>
        <div className="mt-7">
          <LazyVideo
            url={asText(s.videoUrl)}
            poster={asText(s.posterUrl)}
            className="rounded-2xl bg-st-ink"
            buttonClass="flex h-20 w-20 items-center justify-center rounded-full bg-white text-st-brand shadow-xl"
            noteClass="absolute inset-x-3 bottom-3 rounded-lg bg-white px-3 py-2 text-sm leading-snug text-st-bad"
          />
        </div>
      </div>
    </section>
  );
}

function BeforeAfterSlider({ before, after, caption }: { before: string; after: string; caption: string }) {
  const [pos, setPos] = useState(50);
  return (
    <Reveal as="figure" className="mt-8">
      <div className="lp-st-ba relative select-none overflow-hidden rounded-2xl border border-st-line bg-st-soft" style={{ ['--pos' as string]: `${pos}%` }}>
        <Pic src={after} alt={`${caption}: পরের ছবি`} className="block aspect-[4/3] w-full object-cover" />
        <div className="lp-st-before absolute inset-0">
          <Pic src={before} alt={`${caption}: আগের ছবি`} className="block h-full w-full object-cover" />
        </div>
        <span className="absolute left-3 top-3 rounded-full bg-st-ink/80 px-2.5 py-1 font-display text-xs font-bold text-white">আগে</span>
        <span className="absolute right-3 top-3 rounded-full bg-st-brand px-2.5 py-1 font-display text-xs font-bold text-white">পরে</span>
        <div className="lp-st-handle" aria-hidden="true">
          <span className="lp-st-knob">⇄</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={pos}
          onChange={(e) => setPos(Number(e.target.value))}
          aria-label={`আগে ও পরের ছবি তুলনা করতে টানুন (${caption})`}
          className="absolute inset-0 m-0 h-full w-full cursor-ew-resize opacity-0"
        />
      </div>
      {caption ? <figcaption className="mt-2 text-center text-sm text-st-ink/70">{caption}</figcaption> : null}
    </Reveal>
  );
}

function BeforeAfter({ s }: { s: S }) {
  const items = asItems(s.items).filter((i) => itemText(i, 'beforeUrl') && itemText(i, 'afterUrl'));
  return (
    <section data-section="before_after" className="py-14">
      <div className={COL}>
        {asText(s.eyebrow) ? <p className={EYEBROW}>{asText(s.eyebrow)}</p> : null}
        <h2 className={H2}>{asText(s.title)}</h2>
        {asText(s.hint) ? <p className="mt-3 text-base text-st-ink/75">{asText(s.hint)}</p> : null}
        {items.map((item, i) => (
          <BeforeAfterSlider key={i} before={itemText(item, 'beforeUrl')} after={itemText(item, 'afterUrl')} caption={itemText(item, 'caption')} />
        ))}
        <Cta note={asText(s.ctaNote)} label={asText(s.buttonLabel)} />
      </div>
    </section>
  );
}

function Proof({ s }: { s: S }) {
  const shots = asItems(s.screenshots).filter((i) => itemText(i, 'imageUrl'));
  return (
    <section data-section="proof" className="bg-st-soft py-14">
      <div className={COL}>
        {asText(s.eyebrow) ? <p className={EYEBROW}>{asText(s.eyebrow)}</p> : null}
        <h2 className={H2}>
          {asText(s.count) ? <span className="text-st-brand">{asText(s.count)}</span> : null} {asText(s.countSuffix)}
        </h2>
        {asText(s.rating) ? (
          <p className="mt-2 flex items-center gap-1" style={{ color: '#E0A800' }}>
            <Stars rating={5} className="h-6 w-6" />
            <span className="ml-2 font-display text-lg font-bold text-st-ink">{asText(s.rating)} / ৫</span>
          </p>
        ) : null}
        <div className="mt-8 space-y-4">
          {asItems(s.items).map((review, i) => (
            <Reveal key={i} as="figure" className="rounded-2xl border border-st-line bg-white p-5">
              <span style={{ color: '#E0A800' }}>
                <Stars rating={Number(review.rating)} className="h-4 w-4" />
              </span>
              <blockquote className="mt-2 leading-relaxed">“{itemText(review, 'text')}”</blockquote>
              <figcaption className="mt-3 text-sm text-st-ink/65">
                <b className="text-st-ink">{itemText(review, 'name')}</b>
                {itemText(review, 'location') ? `, ${itemText(review, 'location')}` : ''} · যাচাইকৃত ক্রেতা
              </figcaption>
            </Reveal>
          ))}
        </div>
        {shots.length > 0 ? (
          <Reveal className="mt-8 grid grid-cols-3 gap-3">
            {shots.map((shot, i) => (
              <Pic key={i} src={itemText(shot, 'imageUrl')} alt={`গ্রাহকের চ্যাট স্ক্রিনশট ${i + 1}`} className="aspect-[9/16] w-full rounded-xl border border-st-line object-cover" />
            ))}
          </Reveal>
        ) : null}
      </div>
    </section>
  );
}

function Mark({ value }: { value: string }) {
  if (value === '✓') return <span className="text-st-good">✓</span>;
  if (value === '✗' || value === '✕') return <span className="text-st-bad">✗</span>;
  return <span className="text-st-ink">{value}</span>;
}

function Comparison({ s }: { s: S }) {
  return (
    <section data-section="comparison" className="py-14">
      <div className={COL}>
        {asText(s.eyebrow) ? <p className={EYEBROW}>{asText(s.eyebrow)}</p> : null}
        <h2 className={H2}>{asText(s.title)}</h2>
        <Reveal className="mt-7 overflow-hidden rounded-2xl border-2 border-st-brand">
          <table className="w-full text-center text-base">
            <thead>
              <tr className="bg-st-brand font-display text-white">
                <th className="px-3 py-3 text-left font-bold">বিষয়</th>
                <th className="bg-st-brand-dark px-2 py-3 font-bold">{asText(s.ourLabel)}</th>
                <th className="px-2 py-3 font-bold">{asText(s.otherLabel)}</th>
              </tr>
            </thead>
            <tbody>
              {asItems(s.rows).map((row, i) => (
                <tr key={i} className={`border-t border-st-line ${i % 2 ? 'bg-st-soft' : 'bg-white'}`}>
                  <th className="px-3 py-3 text-left font-normal leading-snug">{itemText(row, 'feature')}</th>
                  <td className="bg-st-brand-light/60 px-2 py-3 font-display font-extrabold">
                    <Mark value={itemText(row, 'ours')} />
                  </td>
                  <td className="px-2 py-3 font-display font-extrabold">
                    <Mark value={itemText(row, 'theirs')} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Reveal>
        <Cta note={asText(s.ctaNote)} label={asText(s.buttonLabel)} />
      </div>
    </section>
  );
}

function OfferTimer({ label }: { label: string }) {
  const { countdownEnd } = useLanding();
  const t = useTimeLeft(countdownEnd);
  if (countdownEnd === null) return null;
  return (
    <div className="mt-6">
      {label ? <p className="mb-2 text-center text-sm text-white/80">{label}</p> : null}
      <div className="flex items-center justify-center gap-2 text-center" aria-label="অফার শেষ হতে বাকি সময়">
        {(
          [
            [t.days, 'দিন'],
            [t.hours, 'ঘণ্টা'],
            [t.minutes, 'মিনিট'],
            [t.seconds, 'সেকেন্ড'],
          ] as const
        ).map(([value, unit]) => (
          <div key={unit} className="min-w-[58px] rounded-xl border border-white/25 bg-white/10 px-2 py-2">
            <div className="font-display text-2xl font-extrabold leading-none">{value}</div>
            <div className="mt-0.5 text-[11px] text-white/70">{unit}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Offer({ s }: { s: S }) {
  const { products, lines, setOnlyLine, scrollTo, currency } = useLanding();
  const product = products[0];
  const offers = offersOf(product);
  const cards = asItems(s.cards);
  const total = Number(s.stockTotal) || 0;
  const left = Math.min(total, Number(s.stockLeft) || 0);
  if (!product) return null;
  return (
    <section data-section="offer" className="bg-st-brand py-14 text-white">
      <div className={COL}>
        {asText(s.eyebrow) ? <p className="mb-2 font-display text-sm font-bold tracking-wide text-st-mark">{asText(s.eyebrow)}</p> : null}
        <h2 className={H2}>{asText(s.title)}</h2>
        <OfferTimer label={asText(s.countdownLabel)} />
        <div className="mt-7 space-y-5">
          {offers.map((offer, i) => {
            const card = cards[i];
            const badge = card ? itemText(card, 'badge') : '';
            const save = offer.compareAt && offer.compareAt > offer.price ? offer.compareAt - offer.price : 0;
            const chosen = lines[0]?.variantId === offer.id;
            return (
              <Reveal key={offer.id ?? 'single'} className={`relative rounded-2xl border-2 bg-white p-5 text-st-ink transition-shadow ${badge ? 'border-st-mark' : 'border-white'} ${chosen ? 'shadow-2xl ring-4 ring-st-mark' : ''}`}>
                {badge ? <span className="absolute -top-3 left-5 rounded-full bg-st-mark px-3 py-0.5 font-display text-sm font-bold text-st-ink">{badge}</span> : null}
                <div className="flex items-center gap-4">
                  <Pic src={product.imageUrl ?? ''} alt={offer.name} className="h-20 w-20 shrink-0 rounded-xl bg-st-brand-light object-cover" />
                  <div className="min-w-0 flex-1">
                    <h3 className="font-display text-2xl font-extrabold leading-tight">{offer.name}</h3>
                    {card && itemText(card, 'description') ? <p className="text-sm leading-snug text-st-ink/70">{itemText(card, 'description')}</p> : null}
                  </div>
                </div>
                <div className="mt-4 flex items-end justify-between gap-3">
                  <p className="flex items-baseline gap-2">
                    <span className="font-display text-3xl font-extrabold text-st-brand">{money(offer.price, currency)}</span>
                    {save > 0 ? <span className="text-st-ink/50 line-through">{money(offer.compareAt!, currency)}</span> : null}
                  </p>
                  {save > 0 ? <span className="rounded-full bg-st-good/10 px-3 py-1 text-sm font-bold text-st-good">সাশ্রয় {money(save, currency)}</span> : null}
                </div>
                <button
                  type="button"
                  disabled={!offer.available}
                  onClick={() => {
                    setOnlyLine(product.id, offer.id, lines[0]?.quantity ?? 1);
                    scrollTo('order');
                  }}
                  className={`mt-4 h-12 w-full rounded-xl font-display text-lg font-bold transition-colors disabled:opacity-40 ${badge ? 'bg-st-brand text-white hover:bg-st-brand-dark' : 'bg-st-brand-light text-st-brand-dark hover:bg-st-brand/20'}`}
                >
                  {offer.available ? asText(s.buttonLabel) || 'এটি নিন' : 'স্টক শেষ'}
                </button>
              </Reveal>
            );
          })}
        </div>
        {total > 0 ? (
          <div className="mt-7">
            <div className="flex justify-between font-display text-sm font-bold">
              <span>মাত্র {toBn(left)}টি বাকি</span>
              {asText(s.stockNote) ? <span className="text-st-mark">{asText(s.stockNote)}</span> : null}
            </div>
            <div className="mt-2 h-3 overflow-hidden rounded-full bg-white/20">
              <div className="h-full rounded-full bg-st-mark" style={{ width: `${Math.round((left / total) * 100)}%` }} />
            </div>
          </div>
        ) : null}
        {asText(s.note) ? <p className="mt-5 text-center text-base text-white/85">{asText(s.note)}</p> : null}
      </div>
    </section>
  );
}

function Guarantee({ s }: { s: S }) {
  return (
    <section data-section="guarantee" className="py-14">
      <div className={COL}>
        <Reveal className="text-center">
          <div className="mx-auto flex h-36 w-36 items-center justify-center rounded-full border-4 border-dashed border-st-brand text-st-brand" role="img" aria-label={`${asText(s.sealNumber)} ${asText(s.sealText)}`}>
            <div className="flex h-28 w-28 flex-col items-center justify-center rounded-full bg-st-brand leading-none text-white">
              <span className="font-display text-4xl font-extrabold">{asText(s.sealNumber)}</span>
              <span className="mt-1 max-w-[80%] text-center font-display text-sm font-bold">{asText(s.sealText)}</span>
            </div>
          </div>
          <h2 className={`${H2} mt-6`}>{asText(s.title)}</h2>
          {asText(s.text) ? <p className="mt-3 text-st-ink/80">{asText(s.text)}</p> : null}
        </Reveal>
        <ul className="mt-8 space-y-3">
          {asItems(s.items).map((item, i) => (
            <Reveal key={i} as="li" className="flex gap-4 rounded-xl border border-st-line bg-st-soft p-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-st-brand text-white">
                <LpIcon name={itemText(item, 'icon')} className="h-6 w-6" strokeWidth={1.8} />
              </span>
              <div className="leading-snug">
                <b className="font-display text-lg">{itemText(item, 'title')}</b>
                <br />
                <span className="text-base text-st-ink/75">{itemText(item, 'text')}</span>
              </div>
            </Reveal>
          ))}
        </ul>
        <Cta label={asText(s.buttonLabel)} />
      </div>
    </section>
  );
}

function Faq({ s }: { s: S }) {
  return (
    <section data-section="faq" className="bg-st-soft py-14">
      <div className={COL}>
        {asText(s.eyebrow) ? <p className={EYEBROW}>{asText(s.eyebrow)}</p> : null}
        <h2 className={H2}>{asText(s.title)}</h2>
        <div className="mt-7 space-y-3">
          <FaqList
            items={asItems(s.items)}
            skin={{
              item: 'rounded-xl border border-st-line bg-white',
              button: 'flex min-h-[60px] w-full items-center justify-between gap-4 px-4 py-4 text-left',
              question: 'font-display text-lg font-bold leading-snug',
              panel: 'px-4 pb-4 text-base leading-relaxed text-st-ink/80',
              chevron: 'h-5 w-5 text-st-brand',
            }}
          />
        </div>
      </div>
    </section>
  );
}

function OfferPicker() {
  const { products, lines, setOnlyLine, currency } = useLanding();
  const product = products[0];
  const offers = offersOf(product);
  if (!product) return <p className="py-6 text-center text-st-ink/70">এই অফারটি এখন পাওয়া যাচ্ছে না।</p>;
  const line = lines[0];
  return (
    <div className="space-y-6">
      {offers.length > 1 ? (
        <fieldset>
          <legend className="mb-1.5 block font-display text-lg font-bold">অফার বেছে নিন</legend>
          <div className="space-y-2.5">
            {offers.map((offer) => (
              <label key={offer.id ?? 'single'} className={`flex items-center gap-3 rounded-xl border-2 border-st-line p-3 has-[:checked]:border-st-brand has-[:checked]:bg-st-brand-light ${offer.available ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}>
                <input
                  type="radio"
                  name="lp-offer"
                  disabled={!offer.available}
                  checked={line?.variantId === offer.id}
                  onChange={() => setOnlyLine(product.id, offer.id, line?.quantity ?? 1)}
                  className="h-4 w-4 accent-[rgb(var(--st-brand))]"
                />
                <span className="flex-1 font-display font-bold">{offer.name}</span>
                <span className="text-right">
                  <span className="block font-display font-bold text-st-brand">{money(offer.price, currency)}</span>
                  {offer.compareAt && offer.compareAt > offer.price ? <span className="block text-xs text-st-ink/50 line-through">{money(offer.compareAt, currency)}</span> : null}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : (
        <p className="font-display text-xl font-bold">{product.name}</p>
      )}
      <div className="flex items-center justify-between gap-4">
        <span className="font-display text-lg font-bold">কয়টি সেট</span>
        <QuantityStepper
          value={line?.quantity ?? 1}
          onChange={(next) => line && setOnlyLine(product.id, line.variantId, next)}
          skin={{
            box: 'flex h-12 items-center overflow-hidden rounded-xl border-2 border-st-line',
            button: 'h-full w-12 text-2xl text-st-brand hover:bg-st-brand-light disabled:opacity-40 disabled:hover:bg-transparent',
            value: 'min-w-[44px] text-center font-display text-xl font-bold',
          }}
        />
      </div>
    </div>
  );
}

function Order({ s }: { s: S }) {
  return (
    <section data-section="order" className="bg-st-brand-light py-14">
      <div className={COL}>
        <div className="text-center">
          {asText(s.eyebrow) ? <p className={EYEBROW}>{asText(s.eyebrow)}</p> : null}
          <h2 className={H2}>
            <Marked text={asText(s.title)} markClass={MARK} squiggleClass={SQUIG} />
          </h2>
          {asText(s.subtitle) ? <p className="mt-2 text-base text-st-ink/70">{asText(s.subtitle)}</p> : null}
        </div>
        <LandingOrderForm
          showSavings
          skin={ORDER_SKIN}
          texts={{ buttonLabel: asText(s.buttonLabel) || 'অর্ডার কনফার্ম করুন', note: asText(s.note), successText: asText(s.successText) }}
          products={<OfferPicker />}
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
    <footer data-section="footer" className="bg-st-ink pb-28 pt-12 text-white md:pb-10">
      <div className={COL}>
        <p className="font-display text-3xl font-extrabold">{brand}</p>
        {asText(s.text) ? <p className="mt-2 text-base leading-snug text-white/70">{asText(s.text)}</p> : null}
        <div className="mt-5 flex flex-wrap gap-3">
          {phone ? (
            <a href={`tel:${phone.replace(/[^\d+]/g, '')}`} className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-white/30 px-4 text-base">
              <LpIcon name="phone" className="h-5 w-5" strokeWidth={1.8} />
              {phone}
            </a>
          ) : null}
          {facebook ? (
            <a href={facebook} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-white/30 px-4 text-base">
              <LpIcon name="facebook" className="h-5 w-5" strokeWidth={1.8} />
              Facebook পেজ
            </a>
          ) : null}
        </div>
        <p className="mt-8 border-t border-white/15 pt-5 text-xs leading-relaxed text-white/50">
          © {new Date().getFullYear()} {brand}। {asText(s.disclaimer)}
        </p>
      </div>
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
      className={`fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-3 border-t border-st-line bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_20px_rgba(0,0,0,.1)] transition-transform duration-300 md:hidden ${show ? 'translate-y-0' : 'invisible translate-y-full'}`}
    >
      <div className="leading-tight">
        <div className="font-display text-2xl font-extrabold text-st-brand">{money(price * quantity, currency)}</div>
        <div className="text-xs leading-tight text-st-ink/60">{[variantName, quantity > 1 ? `${toBn(quantity)} সেট` : null].filter(Boolean).join(' · ')}</div>
      </div>
      <button type="button" tabIndex={show ? 0 : -1} onClick={() => scrollTo('order')} className="h-12 rounded-xl bg-st-brand px-7 font-display text-lg font-bold text-white">
        অর্ডার করুন
      </button>
    </div>
  );
}

const SECTIONS: Record<string, (props: { s: S }) => ReactNode> = {
  hero: Hero,
  problem: Problem,
  agitate: Agitate,
  solution: Solution,
  how_it_works: HowItWorks,
  video: Video,
  before_after: BeforeAfter,
  proof: Proof,
  comparison: Comparison,
  offer: Offer,
  guarantee: Guarantee,
  faq: Faq,
  order: Order,
  footer: Footer,
};

export function StoryTemplate() {
  const { content } = useLanding();
  return (
    <div className="bg-white font-sans text-[18px] leading-[1.9] text-st-ink antialiased md:text-[19px]">
      <ReadingProgress />
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
