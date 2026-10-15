'use client';

import { createContext, useContext, useState, type CSSProperties, type ReactNode } from 'react';
import type { LandingValue } from '@ecomesta/utils';
import { FaqList, LpIcon, Marked, Pic, Reveal, Stars, useStickyBar } from '../landing-bits';
import { asItems, asText, discountPercent, itemText, money, toBn, useLanding, type LandingProduct } from '../landing-context';
import { TimerCells } from '../landing-kit';
import { LandingOrderForm, type OrderSkin } from '../landing-order-form';
import { CartList, useLinesTotal } from '../landing-pickers';

type S = Record<string, LandingValue>;

const WRAP = 'mx-auto w-full max-w-6xl px-5 md:px-10';
const H2 = 'mt-3 font-display text-3xl font-semibold leading-tight text-kd-ink md:text-5xl';
const CORAL_BTN =
  'inline-flex items-center justify-center rounded-full bg-kd-coral font-display font-semibold text-white shadow-[0_5px_0_rgb(var(--kd-coral-dark))] transition hover:bg-kd-coral-dark active:translate-y-[3px] active:shadow-[0_2px_0_rgb(var(--kd-coral-dark))] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-kd-coral/30';
const CARD = 'rounded-[2rem] border-4 border-white bg-white shadow-[0_8px_24px_rgba(43,58,85,.10)]';

/** Card colours in turn: coral, sun, mint, sky. */
const TONES = [
  { bg: 'bg-kd-coral text-white', shadow: 'shadow-[0_6px_0_rgb(var(--kd-coral-dark))]', soft: 'bg-kd-coral-soft text-kd-coral-dark' },
  { bg: 'bg-kd-sun text-kd-ink', shadow: 'shadow-[0_6px_0_rgb(var(--kd-sun-dark))]', soft: 'bg-kd-sun-soft text-kd-sun-dark' },
  { bg: 'bg-kd-mint text-kd-ink', shadow: 'shadow-[0_6px_0_rgb(var(--kd-mint-dark))]', soft: 'bg-kd-mint-soft text-kd-mint-dark' },
  { bg: 'bg-kd-sky text-white', shadow: 'shadow-[0_6px_0_rgb(var(--kd-sky-dark))]', soft: 'bg-kd-sky-soft text-kd-sky-dark' },
] as const;

const ORDER_SKIN: OrderSkin = {
  form: 'space-y-6 rounded-[2.5rem] bg-white p-5 shadow-[0_8px_0_rgba(43,58,85,.15)] md:p-9',
  label: 'mb-1.5 block pl-1 font-display text-lg font-semibold',
  input: 'h-12 w-full rounded-full border-2 border-kd-line bg-white px-5 text-base placeholder:text-kd-mute/60 focus:border-kd-sky focus:outline-none focus:ring-4 focus:ring-kd-sky/20',
  inputInvalid: 'border-kd-bad',
  select: 'h-12 w-full rounded-full border-2 border-kd-line bg-white px-4 text-base focus:border-kd-sky focus:outline-none focus:ring-4 focus:ring-kd-sky/20 disabled:opacity-60',
  error: 'mt-1 pl-1 text-sm text-kd-bad',
  choice: 'flex cursor-pointer items-center gap-3 rounded-3xl border-2 border-kd-line p-4 has-[:checked]:border-kd-sky has-[:checked]:bg-kd-sky-soft has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-kd-sky/30',
  choiceTitle: 'block font-display font-semibold',
  choiceHint: 'block text-sm text-kd-mute',
  choicePrice: 'font-display font-semibold text-kd-sky-dark',
  radio: 'h-4 w-4 accent-[rgb(var(--kd-sky))]',
  summary: 'space-y-2 rounded-3xl bg-kd-sky-soft p-5',
  summaryLabel: 'text-kd-mute',
  summaryValue: '',
  totalLabel: 'font-display text-lg font-semibold',
  totalValue: 'font-display text-3xl font-semibold text-kd-sky-dark',
  divider: 'mt-3 border-t-2 border-dashed border-kd-sky/40 pt-1',
  savingValue: 'font-semibold text-kd-mint-dark',
  formError: 'mb-3 text-center text-sm text-kd-bad',
  button: `${CORAL_BTN} h-14 w-full text-lg disabled:opacity-60`,
  note: 'mt-3 text-center text-sm text-kd-mute',
  success: {
    box: 'rounded-[2.5rem] bg-white p-8 text-center shadow-[0_8px_0_rgba(43,58,85,.15)] focus:outline-none',
    icon: 'mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-kd-mint text-white',
    title: 'mt-4 font-display text-4xl font-semibold',
    text: 'mt-3 text-lg',
    total: 'mt-2 font-semibold text-kd-sky-dark',
    link: 'mt-6 inline-flex h-11 items-center rounded-full border-2 border-kd-sky px-6 font-display font-semibold text-kd-sky-dark hover:bg-kd-sky-soft',
  },
};

/** The age shoppers picked (shared by the age cards and the product filter). */
const AgeFilter = createContext<{ age: string; setAge: (age: string) => void }>({ age: 'all', setAge: () => {} });

function ages(value: string): string[] {
  return value
    .split(/[,،]/)
    .map((a) => a.trim())
    .filter(Boolean);
}

function Wave({ fill }: { fill: string }) {
  return (
    <svg viewBox="0 0 1440 48" preserveAspectRatio="none" className={`absolute left-0 -top-[23px] h-6 w-full md:h-10 ${fill}`} aria-hidden="true">
      <path fill="currentColor" d="M0 48V24c120-28 240-28 360-4s240 28 360 4 240-28 360-4 240 24 360 4v24z" />
    </svg>
  );
}

function Doodle({ kind, className, style }: { kind: 'star' | 'cloud' | 'balloon'; className: string; style?: CSSProperties }) {
  if (kind === 'cloud')
    return (
      <svg viewBox="0 0 80 48" className={className} style={style} aria-hidden="true">
        <path d="M20 44a14 14 0 01-2-27.8A18 18 0 0153 14a15 15 0 018 29z" fill="currentColor" />
      </svg>
    );
  if (kind === 'balloon')
    return (
      <svg viewBox="0 0 40 70" className={className} style={style} aria-hidden="true">
        <ellipse cx="20" cy="20" rx="15" ry="18" fill="currentColor" />
        <path d="M20 38l-3 5h6zM20 43c-4 8 4 12 0 24" fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>
    );
  return (
    <svg viewBox="0 0 40 40" className={className} style={style} aria-hidden="true">
      <path d="M20 3l4.5 10.5 11.5 1-8.7 7.5 2.7 11.2L20 27l-10 6.2 2.7-11.2L4 14.5l11.5-1z" fill="currentColor" />
    </svg>
  );
}

function Pill({ children, className }: { children: ReactNode; className: string }) {
  return <p className={`inline-block rounded-full px-4 py-1 font-display text-sm font-semibold ${className}`}>{children}</p>;
}

function Header({ eyebrow, title, subtitle, pill = 'bg-white text-kd-sky-dark' }: { eyebrow: string; title: string; subtitle?: string; pill?: string }) {
  return (
    <Reveal className="mx-auto max-w-2xl text-center">
      {eyebrow ? <Pill className={pill}>{eyebrow}</Pill> : null}
      <h2 className={H2}>{title}</h2>
      {subtitle ? <p className="mt-2 text-kd-mute">{subtitle}</p> : null}
    </Reveal>
  );
}

function Hero({ s }: { s: S }) {
  const { brand, scrollTo, countdownEnd } = useLanding();
  return (
    <section data-section="hero" className="relative overflow-hidden bg-kd-sun-soft">
      <Doodle kind="cloud" className="lp-kd-float absolute left-3 top-16 w-16 text-white" />
      <Doodle kind="balloon" className="lp-kd-float absolute right-4 top-40 w-14 text-kd-sky/60" style={{ ['--r' as string]: '10deg', animationDelay: '.8s' }} />
      <Doodle kind="star" className="lp-kd-float absolute bottom-24 left-6 w-8 text-kd-sun" style={{ animationDelay: '1.4s' }} />
      <Doodle kind="star" className="lp-kd-float absolute right-1/3 top-6 w-6 text-kd-coral/70" style={{ animationDelay: '.3s' }} />
      <div className={`relative ${WRAP}`}>
        <div className="flex items-center justify-between py-5">
          <span className="font-display text-2xl font-semibold text-kd-coral-dark">{asText(s.brand) || brand}</span>
          <button type="button" onClick={() => scrollTo('order')} className="py-2 text-sm font-semibold text-kd-sky-dark">
            অর্ডার করুন
          </button>
        </div>
        <div className="grid items-center gap-8 pb-20 md:grid-cols-2 md:gap-14 md:pb-28">
          <div className="text-center md:text-left">
            {asText(s.badge) ? <Pill className="bg-white text-kd-coral-dark">{asText(s.badge)}</Pill> : null}
            <h1 className="mt-4 font-display text-4xl font-semibold leading-[1.2] sm:text-5xl md:text-6xl">
              <Marked text={asText(s.title)} markClass="bg-transparent text-kd-coral" squiggleClass="no-underline text-kd-sky-dark" />
            </h1>
            {asText(s.subtitle) ? <p className="mt-4 text-lg text-kd-mute">{asText(s.subtitle)}</p> : null}
            <div className="mt-5 inline-flex flex-wrap justify-center gap-2 md:justify-start">
              {asText(s.offerBadge) ? (
                <span className="rounded-full bg-kd-coral px-4 py-1.5 font-display font-semibold text-white shadow-[0_3px_0_rgb(var(--kd-coral-dark))]">{asText(s.offerBadge)}</span>
              ) : null}
              {asText(s.deliveryBadge) ? (
                <span className="rounded-full bg-kd-mint px-4 py-1.5 font-display font-semibold text-kd-ink shadow-[0_3px_0_rgb(var(--kd-mint-dark))]">{asText(s.deliveryBadge)}</span>
              ) : null}
            </div>
            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row md:justify-start">
              {asText(s.buttonLabel) ? (
                <button type="button" data-hero-cta onClick={() => scrollTo('products')} className={`${CORAL_BTN} h-14 px-10 text-lg`}>
                  {asText(s.buttonLabel)}
                </button>
              ) : null}
              {asText(s.orderLabel) ? (
                <button type="button" onClick={() => scrollTo('order')} className="h-14 rounded-full border-2 border-kd-ink/10 bg-white px-8 font-display font-semibold text-kd-ink shadow-[0_4px_0_rgba(43,58,85,.12)]">
                  {asText(s.orderLabel)}
                </button>
              ) : null}
            </div>
            {countdownEnd !== null ? (
              <div className="mt-6">
                {asText(s.countdownLabel) ? <p className="mb-2 text-sm text-kd-mute">{asText(s.countdownLabel)}</p> : null}
                <TimerCells
                  skin={{
                    box: 'inline-flex items-center gap-2 text-center',
                    cell: 'min-w-[56px] rounded-2xl px-2 py-1.5 shadow-[0_3px_0_rgba(43,58,85,.15)]',
                    value: 'font-display text-2xl font-semibold leading-none',
                    label: 'text-[11px] opacity-90',
                  }}
                  cellClasses={['bg-kd-coral text-white', 'bg-kd-sun text-kd-ink', 'bg-kd-mint text-white', 'bg-kd-sky text-white']}
                />
              </div>
            ) : null}
          </div>
          <div className="relative">
            {asText(s.imageUrl) ? (
              <Pic src={asText(s.imageUrl)} alt="" eager className="mx-auto aspect-square w-full max-w-md rotate-2 rounded-[3rem] border-[6px] border-white bg-kd-coral-soft object-cover shadow-[0_14px_0_rgb(var(--kd-sun)/0.6)]" />
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function AgeGroups({ s }: { s: S }) {
  const { scrollTo } = useLanding();
  const { age, setAge } = useContext(AgeFilter);
  return (
    <section data-section="age_groups" className="relative bg-kd-paper py-14 md:py-20">
      <Wave fill="text-kd-paper" />
      <div className={WRAP}>
        <Header eyebrow={asText(s.eyebrow)} title={asText(s.title)} pill="bg-kd-sky-soft text-kd-sky-dark" />
        <div className="mt-8 grid grid-cols-2 gap-4 md:gap-6 lg:grid-cols-4">
          {asItems(s.items).map((item, i) => {
            const tone = TONES[i % TONES.length]!;
            const label = itemText(item, 'label');
            return (
              <button
                key={i}
                type="button"
                aria-pressed={age === label}
                onClick={() => {
                  setAge(label);
                  scrollTo('products');
                }}
                className={`relative overflow-hidden rounded-[2rem] p-5 pb-6 text-left transition-transform hover:-translate-y-1 active:translate-y-1 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-kd-ink ${tone.bg} ${tone.shadow}`}
              >
                <Doodle kind={(['star', 'balloon', 'cloud', 'star'] as const)[i % 4]!} className="absolute -bottom-2 -right-2 w-16 text-white opacity-30" />
                <span className="block font-display text-5xl font-semibold leading-none">{label}</span>
                <span className="block font-display text-lg font-semibold">{itemText(item, 'unit')}</span>
                {itemText(item, 'text') ? <span className="mt-2 block text-sm leading-snug opacity-90">{itemText(item, 'text')}</span> : null}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/** One product card: photo, age tag, price, variant and "add". */
function ProductCard({ product, ageLabel, addLabel, wide, tag }: { product: LandingProduct; ageLabel: string; addLabel: string; wide?: boolean; tag?: string }) {
  const { addLine, currency } = useLanding();
  const [variantId, setVariantId] = useState(product.variants.find((v) => v.available)?.id ?? '');
  const [added, setAdded] = useState(false);
  const variant = product.variants.find((v) => v.id === variantId);
  const price = variant?.price ?? product.price;
  const compareAt = variant ? variant.compareAt : product.compareAt;
  const off = discountPercent(price, compareAt);
  const soldOut = !product.available;
  const add = () => {
    addLine(product.id, variant?.id ?? null);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1600);
  };
  const picker =
    product.variants.length > 0 ? (
      <>
        <label className="mt-3 text-xs font-semibold text-kd-mute" htmlFor={`v-${product.id}`}>
          সাইজ/রং বাছুন
        </label>
        <select
          id={`v-${product.id}`}
          value={variantId}
          onChange={(e) => setVariantId(e.target.value)}
          className="mt-1 h-11 w-full rounded-full border-2 border-kd-line bg-kd-paper px-4 text-base focus:border-kd-sky focus:outline-none"
        >
          {product.variants.map((v) => (
            <option key={v.id} value={v.id} disabled={!v.available}>
              {v.name}
              {v.available ? '' : ' (স্টক শেষ)'}
            </option>
          ))}
        </select>
      </>
    ) : null;
  const button = (
    <button type="button" onClick={add} disabled={soldOut || (product.variants.length > 0 && !variant)} className={`${CORAL_BTN} mt-4 h-12 w-full disabled:bg-kd-line disabled:text-kd-mute disabled:shadow-none`}>
      {soldOut ? 'স্টক শেষ' : added ? '✓ যোগ হয়েছে' : addLabel}
    </button>
  );
  const prices = (
    <p className="mt-1 flex flex-wrap items-baseline gap-2">
      <span className={`font-display font-semibold text-kd-sky-dark ${wide ? 'text-3xl' : 'text-2xl'}`}>{money(price, currency)}</span>
      {compareAt && compareAt > price ? <span className="text-sm text-kd-mute line-through">{money(compareAt, currency)}</span> : null}
      {wide && off > 0 ? <span className="rounded-full bg-kd-mint-soft px-2 py-0.5 text-xs font-semibold text-kd-mint-dark">{toBn(off)}% ছাড়</span> : null}
    </p>
  );
  if (wide) {
    return (
      <Reveal as="article" className={`grid overflow-hidden sm:grid-cols-2 ${CARD}`}>
        <Pic src={product.imageUrl ?? ''} alt={product.name} className="aspect-square h-full w-full object-cover sm:aspect-auto" />
        <div className="flex flex-col p-5">
          {tag ? <span className="self-start rounded-full bg-kd-coral px-3 py-1 font-display text-xs font-semibold text-white">{tag}</span> : null}
          <h3 className="mt-2 font-display text-2xl font-semibold leading-snug">{product.name}</h3>
          {product.note ? <p className="mt-1 text-sm leading-snug text-kd-mute">{product.note}</p> : null}
          {prices}
          {picker}
          {button}
        </div>
      </Reveal>
    );
  }
  return (
    <Reveal as="article" className={`flex flex-col overflow-hidden ${CARD}`}>
      <div className="relative">
        <Pic src={product.imageUrl ?? ''} alt={product.name} className="aspect-square w-full bg-kd-coral-soft object-cover" />
        {ageLabel ? <span className="absolute left-3 top-3 rounded-full bg-white px-3 py-1 font-display text-xs font-semibold text-kd-ink shadow">{ageLabel}</span> : null}
        {off > 0 ? <span className="absolute right-3 top-3 rotate-3 rounded-full bg-kd-coral px-3 py-1 font-display text-xs font-semibold text-white shadow">{toBn(off)}% ছাড়</span> : null}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-display text-lg font-semibold leading-snug">{product.name}</h3>
        {prices}
        {picker}
        <div className="mt-auto">{button}</div>
      </div>
    </Reveal>
  );
}

function Products({ s }: { s: S }) {
  const { products, settings } = useLanding();
  const { age, setAge } = useContext(AgeFilter);
  const groups = asItems(settings('age_groups')?.items).map((g) => itemText(g, 'label')).filter(Boolean);
  const tags = asItems(s.ages).map((a) => ages(itemText(a, 'ages')));
  const unit = itemText(asItems(settings('age_groups')?.items)[0] ?? {}, 'unit');
  const shown = products.map((product, i) => ({ product, tags: tags[i] ?? [] })).filter((p) => age === 'all' || p.tags.includes(age));
  return (
    <section data-section="products" className="relative scroll-mt-2 bg-kd-sky-soft py-14 md:py-20">
      <Wave fill="text-kd-sky-soft" />
      <div className={WRAP}>
        <Header eyebrow={asText(s.eyebrow)} title={asText(s.title)} />
        {groups.length > 0 ? (
          <div className="mt-6 flex flex-wrap justify-center gap-2" role="group" aria-label="বয়স অনুযায়ী ফিল্টার">
            {['all', ...groups].map((g) => (
              <button
                key={g}
                type="button"
                aria-pressed={age === g}
                onClick={() => setAge(g)}
                className={`h-11 rounded-full px-5 font-display font-semibold shadow-[0_3px_0_rgba(43,58,85,.12)] ${age === g ? 'bg-kd-ink text-white' : 'bg-white text-kd-ink'}`}
              >
                {g === 'all' ? 'সব' : `${g} ${unit}`.trim()}
              </button>
            ))}
          </div>
        ) : null}
        <p className="mt-4 text-center text-sm text-kd-mute" aria-live="polite">
          {toBn(shown.length)}টি পণ্য দেখানো হচ্ছে
        </p>
        <div className="mt-8 grid grid-cols-1 gap-5 min-[480px]:grid-cols-2 lg:grid-cols-4">
          {shown.map(({ product, tags: t }) => (
            <ProductCard key={product.id} product={product} ageLabel={t.map((a) => `${a} ${unit}`.trim()).join(' · ')} addLabel={asText(s.addLabel) || 'যোগ করুন'} />
          ))}
        </div>
        {shown.length === 0 ? <p className="mt-8 text-center text-kd-mute">এই বয়সের জন্য কোনো পণ্য পাওয়া যায়নি। &quot;সব&quot; চাপুন।</p> : null}
        {asText(s.note) ? <p className="mt-8 text-center text-kd-ink">{asText(s.note)}</p> : null}
      </div>
    </section>
  );
}

function IconCards({ s, type, bg }: { s: S; type: string; bg: string }) {
  return (
    <section data-section={type} className={`relative py-14 md:py-20 ${bg}`}>
      <Wave fill={bg.replace('bg-', 'text-')} />
      <div className={WRAP}>
        <Header eyebrow={asText(s.eyebrow)} title={asText(s.title)} pill="bg-kd-mint-soft text-kd-mint-dark" />
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {asItems(s.items).map((item, i) => {
            const tone = TONES[(i + 3) % TONES.length]!;
            return (
              <Reveal key={i} className={`${CARD} p-6 text-center`}>
                <span className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${tone.soft}`}>
                  <LpIcon name={itemText(item, 'icon')} className="h-8 w-8" strokeWidth={1.8} />
                </span>
                <h3 className="mt-4 font-display text-xl font-semibold">{itemText(item, 'title')}</h3>
                <p className="mt-1 text-sm leading-snug text-kd-mute md:text-base">{itemText(item, 'text')}</p>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Combo({ s }: { s: S }) {
  const { productById, preview } = useLanding();
  const ids = Array.isArray(s.productIds) ? (s.productIds as string[]) : [];
  const combos = ids.map((id) => productById(id)).filter((p): p is LandingProduct => !!p && !p.demo);
  if (combos.length === 0 && !preview) return null;
  return (
    <section data-section="combo" className="relative bg-kd-sun-soft py-14 md:py-20">
      <Wave fill="text-kd-sun-soft" />
      <div className={WRAP}>
        <Header eyebrow={asText(s.eyebrow)} title={asText(s.title)} subtitle={asText(s.subtitle)} pill="bg-white text-kd-coral-dark" />
        {combos.length === 0 ? (
          <p className="mx-auto mt-8 max-w-xl rounded-3xl border-2 border-dashed border-kd-line bg-white p-6 text-center text-kd-mute">
            এডিটরে এই অংশের জন্য ১-২টি গিফট সেট পণ্য বেছে নিন।
          </p>
        ) : (
          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            {combos.map((product) => (
              <ProductCard key={product.id} product={product} ageLabel="" addLabel={asText(s.addLabel) || 'যোগ করুন'} wide tag={asText(s.tag)} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function ParentsLove({ s }: { s: S }) {
  return (
    <section data-section="parents_love" className="relative bg-kd-paper py-14 md:py-20">
      <Wave fill="text-kd-paper" />
      <div className={WRAP}>
        <Header eyebrow={asText(s.eyebrow)} title={asText(s.title)} pill="bg-kd-coral-soft text-kd-coral-dark" />
        <ul className="mx-auto mt-10 grid max-w-3xl gap-4 sm:grid-cols-2">
          {asItems(s.items).map((item, i) => {
            const tone = TONES[i % TONES.length]!;
            return (
              <Reveal as="li" key={i} className="flex items-center gap-4 rounded-full border-4 border-white bg-white p-3 pr-6 shadow-[0_6px_18px_rgba(43,58,85,.08)]">
                <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${tone.bg}`}>
                  <LpIcon name={itemText(item, 'icon')} className="h-7 w-7" strokeWidth={1.8} />
                </span>
                <div className="leading-tight">
                  <h3 className="font-display text-lg font-semibold">{itemText(item, 'title')}</h3>
                  <p className="mt-0.5 text-sm text-kd-mute">{itemText(item, 'text')}</p>
                </div>
              </Reveal>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

function Reviews({ s }: { s: S }) {
  return (
    <section data-section="reviews" className="relative bg-kd-mint-soft py-14 md:py-20">
      <Wave fill="text-kd-mint-soft" />
      <div className={WRAP}>
        <Header eyebrow={asText(s.eyebrow)} title={asText(s.title)} pill="bg-white text-kd-mint-dark" />
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {asItems(s.items).map((review, i) => (
            <Reveal as="figure" key={i} className={`flex flex-col overflow-hidden ${CARD}`}>
              {itemText(review, 'imageUrl') ? <Pic src={itemText(review, 'imageUrl')} alt={itemText(review, 'child') || itemText(review, 'name')} className="aspect-[6/5] w-full object-cover" /> : null}
              <div className="flex-1 p-5">
                <span className="text-kd-sun-dark">
                  <Stars rating={Number(review.rating)} className="h-4 w-4" />
                </span>
                <blockquote className="mt-2 text-sm leading-relaxed md:text-base">“{itemText(review, 'text')}”</blockquote>
                <figcaption className="mt-3 text-sm text-kd-mute">
                  <b className="text-kd-ink">{itemText(review, 'name')}</b>
                  {itemText(review, 'location') ? `, ${itemText(review, 'location')}` : ''}
                  {itemText(review, 'child') ? <span className="block text-xs">{itemText(review, 'child')}</span> : null}
                </figcaption>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Gift({ s }: { s: S }) {
  const { productById, addLine, lines, scrollTo, currency } = useLanding();
  const ids = Array.isArray(s.productIds) ? (s.productIds as string[]) : [];
  const wrap = ids.map((id) => productById(id)).find((p): p is LandingProduct => !!p && !p.demo && p.available);
  const inCart = wrap ? lines.some((l) => l.productId === wrap.id) : false;
  const onClick = () => {
    if (wrap && !inCart) addLine(wrap.id, wrap.variants.find((v) => v.available)?.id ?? null);
    scrollTo('order');
  };
  return (
    <section data-section="gift" className="relative bg-kd-paper py-14 md:py-20">
      <Wave fill="text-kd-paper" />
      <div className={WRAP}>
        <Reveal className="relative grid items-center gap-6 overflow-hidden rounded-[2.5rem] bg-kd-coral p-7 text-white shadow-[0_10px_0_rgb(var(--kd-coral-dark))] md:grid-cols-5 md:p-12">
          <Doodle kind="star" className="lp-kd-float absolute -top-3 right-6 w-10 text-kd-sun" />
          <Doodle kind="cloud" className="lp-kd-float absolute bottom-3 right-1/3 w-12 text-white/40" style={{ animationDelay: '1s' }} />
          <div className="relative md:col-span-3">
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-white text-kd-coral">
              <LpIcon name="gift" className="h-8 w-8" strokeWidth={1.8} />
            </span>
            <h2 className="mt-4 font-display text-3xl font-semibold leading-tight md:text-4xl">{asText(s.title)}</h2>
            <p className="mt-3 text-lg text-white/90">
              {asText(s.text)}
              {wrap ? <> মাত্র <b>{money(wrap.price, currency)}</b> বাড়তি।</> : null}
            </p>
            {asText(s.buttonLabel) ? (
              <button type="button" onClick={onClick} className="mt-6 h-14 rounded-full bg-white px-8 font-display text-lg font-semibold text-kd-coral-dark shadow-[0_5px_0_rgba(43,58,85,.2)] transition active:translate-y-[3px]">
                {inCart ? '✓ গিফট র‍্যাপ যোগ হয়েছে' : asText(s.buttonLabel)}
              </button>
            ) : null}
          </div>
          {asText(s.imageUrl) ? <Pic src={asText(s.imageUrl)} alt="" className="relative aspect-[5/4] w-full -rotate-2 rounded-[2rem] border-4 border-white object-cover md:col-span-2" /> : null}
        </Reveal>
      </div>
    </section>
  );
}

function Faq({ s }: { s: S }) {
  return (
    <section data-section="faq" className="relative bg-kd-sky-soft py-14 md:py-20">
      <Wave fill="text-kd-sky-soft" />
      <div className={WRAP}>
        <div className="mx-auto max-w-3xl">
          <Header eyebrow={asText(s.eyebrow)} title={asText(s.title)} />
          <div className="mt-8 space-y-3">
            <FaqList
              items={asItems(s.items)}
              skin={{
                item: 'rounded-3xl border-4 border-white bg-white shadow-[0_5px_14px_rgba(43,58,85,.06)]',
                button: 'flex min-h-[60px] w-full items-center justify-between gap-4 px-5 py-4 text-left',
                question: 'font-display text-lg font-semibold leading-snug',
                panel: 'px-5 pb-5 leading-relaxed text-kd-mute',
                chevron: 'h-6 w-6 text-kd-coral',
              }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function Order({ s }: { s: S }) {
  const { scrollTo } = useLanding();
  return (
    <section data-section="order" className="relative bg-kd-sun py-14 md:py-20">
      <Wave fill="text-kd-sun" />
      <div className={WRAP}>
        <div className="mx-auto max-w-2xl">
          <div className="mb-8 text-center">
            {asText(s.eyebrow) ? <Pill className="bg-white text-kd-coral-dark">{asText(s.eyebrow)}</Pill> : null}
            <h2 className={H2}>{asText(s.title)}</h2>
            {asText(s.subtitle) ? <p className="mt-2 text-kd-ink/80">{asText(s.subtitle)}</p> : null}
          </div>
          <LandingOrderForm
            showSavings
            skin={ORDER_SKIN}
            texts={{ buttonLabel: asText(s.buttonLabel) || 'অর্ডার কনফার্ম করুন', note: asText(s.note), successText: asText(s.successText) }}
            products={
              <div>
                <p className="mb-1.5 block pl-1 font-display text-lg font-semibold">আপনার নির্বাচিত পণ্য</p>
                <CartList
                  emptyText="উপরে থেকে পণ্য যোগ করুন"
                  skin={{
                    box: 'rounded-3xl border-2 border-dashed border-kd-line bg-kd-paper px-4',
                    empty: 'py-10 text-center text-kd-mute',
                    item: 'flex gap-3 border-b border-kd-line py-4 last:border-0',
                    image: 'h-[72px] w-[72px] shrink-0 rounded-2xl bg-kd-coral-soft object-cover',
                    name: 'font-display font-semibold leading-snug',
                    variant: 'text-sm text-kd-mute',
                    remove: '-mr-2 -mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-kd-mute hover:bg-kd-coral-soft hover:text-kd-bad',
                    stepper: {
                      box: 'flex h-10 items-center rounded-full border-2 border-kd-line bg-white px-1',
                      button: 'h-8 w-8 rounded-full text-xl text-kd-sky-dark hover:bg-kd-sky-soft disabled:opacity-40 disabled:hover:bg-transparent',
                      value: 'min-w-[30px] text-center font-display font-semibold',
                    },
                    price: 'font-display font-semibold text-kd-sky-dark',
                    oldPrice: 'text-xs text-kd-mute line-through',
                  }}
                />
                <button type="button" onClick={() => scrollTo('products')} className="inline-flex h-11 items-center pl-1 font-display font-semibold text-kd-sky-dark underline">
                  + আরও পণ্য যোগ করুন
                </button>
              </div>
            }
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
    <footer data-section="footer" className="relative mt-6 bg-kd-ink pb-28 pt-14 text-white md:pb-10">
      <Wave fill="text-kd-ink" />
      <div className={WRAP}>
        <div className="grid items-center gap-8 md:grid-cols-2">
          <div>
            <p className="font-display text-3xl font-semibold">{brand}</p>
            {asText(s.text) ? <p className="mt-2 max-w-sm leading-snug text-white/70">{asText(s.text)}</p> : null}
          </div>
          <div className="space-y-3 md:text-right">
            {phone ? (
              <a href={`tel:${phone.replace(/[^\d+]/g, '')}`} className="inline-flex min-h-[44px] items-center gap-2 text-lg">
                <LpIcon name="phone" className="h-5 w-5" strokeWidth={1.8} />
                {phone}
              </a>
            ) : null}
            {facebook ? (
              <div>
                <a href={facebook} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center gap-2 rounded-full border-2 border-white/30 px-5 transition-colors hover:bg-white hover:text-kd-ink">
                  <LpIcon name="facebook" className="h-5 w-5" strokeWidth={1.8} />
                  Facebook পেজ
                </a>
              </div>
            ) : null}
          </div>
        </div>
        <p className="mt-10 border-t border-white/15 pt-5 text-xs leading-relaxed text-white/50">
          © {new Date().getFullYear()} {brand}। সর্বস্বত্ব সংরক্ষিত। {asText(s.disclaimer)}
        </p>
      </div>
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
      className={`fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-3 border-t-4 border-kd-sun bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-6px_20px_rgba(43,58,85,.12)] transition-transform duration-300 md:hidden ${show ? 'translate-y-0' : 'invisible translate-y-full'}`}
    >
      <span className="font-display font-semibold">{count > 0 ? `${toBn(count)}টি পণ্য · ${money(total, currency)}` : 'কার্ট খালি'}</span>
      <button type="button" tabIndex={show ? 0 : -1} onClick={() => scrollTo(count > 0 ? 'order' : 'products')} className={`${CORAL_BTN} h-12 px-7`}>
        {count > 0 ? 'অর্ডার করুন' : 'পণ্য দেখুন'}
      </button>
    </div>
  );
}

const SECTIONS: Record<string, (props: { s: S }) => ReactNode> = {
  hero: Hero,
  age_groups: AgeGroups,
  products: Products,
  safety: ({ s }) => <IconCards s={s} type="safety" bg="bg-kd-paper" />,
  combo: Combo,
  parents_love: ParentsLove,
  reviews: Reviews,
  gift: Gift,
  faq: Faq,
  order: Order,
  footer: Footer,
};

export function KidsTemplate() {
  const { content } = useLanding();
  const [age, setAge] = useState('all');
  return (
    <AgeFilter.Provider value={{ age, setAge }}>
      <div className="overflow-x-hidden bg-kd-paper font-sans leading-[1.75] text-kd-ink antialiased">
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
    </AgeFilter.Provider>
  );
}
