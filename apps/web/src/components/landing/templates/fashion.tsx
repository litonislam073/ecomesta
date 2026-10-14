'use client';

import { useRef, useState, type ReactNode } from 'react';
import type { LandingItem, LandingValue } from '@ecomesta/utils';
import { FaqList, LpIcon, Pic, Reveal, Stars, useStickyBar } from '../landing-bits';
import { asItems, asText, discountPercent, itemText, money, toBn, useLanding, type LandingProduct } from '../landing-context';
import { LandingOrderForm, type OrderSkin } from '../landing-order-form';
import { CartList, useLinesTotal } from '../landing-pickers';

type S = Record<string, LandingValue>;

const EYEBROW = 'mb-3 text-[11px] uppercase tracking-[0.18em] text-fa-taupe';
const SANS_LABEL = 'mb-2 block text-[11px] uppercase tracking-[0.18em] text-fa-taupe';

const ORDER_SKIN: OrderSkin = {
  form: '',
  label: SANS_LABEL,
  input: 'h-12 w-full border border-fa-ink bg-white px-4 text-base placeholder:text-fa-taupe/60 focus:outline-none focus:ring-2 focus:ring-fa-rose',
  inputInvalid: 'border-fa-error',
  select: 'h-12 w-full border border-fa-ink bg-white px-3 text-base focus:outline-none focus:ring-2 focus:ring-fa-rose disabled:opacity-60',
  error: 'mt-1 text-sm text-fa-error',
  choice:
    'flex cursor-pointer items-center gap-3 border border-fa-line bg-white p-4 has-[:checked]:border-fa-ink has-[:checked]:ring-1 has-[:checked]:ring-fa-ink has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-fa-rose',
  choiceTitle: 'block font-medium',
  choiceHint: 'block text-sm text-fa-taupe',
  choicePrice: 'text-sm font-semibold',
  radio: 'h-4 w-4 accent-[rgb(var(--fa-ink))]',
  summary: 'space-y-2 text-[15px]',
  summaryLabel: 'text-fa-taupe',
  summaryValue: '',
  totalLabel: 'font-medium',
  totalValue: 'font-display text-3xl',
  divider: 'mt-3 border-t border-fa-ink pt-1',
  savingValue: 'text-fa-rose',
  formError: 'mb-3 text-sm text-fa-error',
  button: 'h-14 w-full bg-fa-ink tracking-widest text-fa-ivory transition-colors hover:bg-fa-charcoal disabled:opacity-60',
  note: 'mt-3 text-center text-xs text-fa-taupe',
  success: {
    box: 'border border-fa-ink bg-white p-8 text-center focus:outline-none md:p-12',
    icon: 'mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-fa-ink',
    title: 'font-display text-4xl md:text-5xl',
    text: 'mt-3 text-lg',
    total: 'mt-2 text-fa-taupe',
    link: 'mt-6 inline-flex h-11 items-center border border-fa-ink px-6 text-sm tracking-widest hover:bg-fa-sand',
  },
};

function Hero({ s }: { s: S }) {
  const { brand, scrollTo } = useLanding();
  return (
    <section data-section="hero" className="relative flex min-h-[100svh] flex-col bg-fa-ink text-fa-ivory">
      <Pic src={asText(s.imageUrl)} alt={asText(s.title)} eager className="absolute inset-0 h-full w-full object-cover opacity-70" />
      <div className="absolute inset-0 bg-gradient-to-t from-fa-ink via-fa-ink/30 to-fa-ink/40" />
      <header className="relative z-10 flex items-center justify-between px-5 py-5 md:px-12">
        <span className="font-display text-2xl tracking-[0.3em]">{(asText(s.brand) || brand).toUpperCase()}</span>
        <button type="button" onClick={() => scrollTo('order')} className="border-b border-fa-ivory/60 py-2 text-[11px] uppercase tracking-[0.2em]">
          অর্ডার করুন
        </button>
      </header>
      <div className="relative z-10 mt-auto max-w-3xl px-5 pb-14 md:px-12 md:pb-20">
        {asText(s.eyebrow) ? <p className="mb-4 text-[11px] uppercase tracking-[0.3em] text-fa-rose-light">{asText(s.eyebrow)}</p> : null}
        <h1 className="font-display text-6xl font-medium leading-[0.95] sm:text-7xl md:text-8xl">
          {asText(s.title)}
          {asText(s.titleItalic) ? (
            <>
              <br />
              <em className="font-medium">{asText(s.titleItalic)}</em>
            </>
          ) : null}
        </h1>
        {asText(s.subtitle) ? <p className="mt-5 max-w-md text-lg text-fa-ivory/85">{asText(s.subtitle)}</p> : null}
        {asText(s.buttonLabel) ? (
          <button
            type="button"
            data-hero-cta=""
            onClick={() => scrollTo('products')}
            className="mt-8 inline-flex h-14 items-center justify-center bg-fa-ivory px-9 text-sm tracking-widest text-fa-ink transition-colors hover:bg-fa-rose-light"
          >
            {asText(s.buttonLabel)}
          </button>
        ) : null}
      </div>
    </section>
  );
}

function Story({ s }: { s: S }) {
  return (
    <section data-section="story" className="px-5 py-20 md:px-12 md:py-32">
      <div className="mx-auto grid max-w-6xl items-center gap-10 md:grid-cols-12 md:gap-8">
        <Reveal className="md:col-span-5">
          <Pic src={asText(s.imageUrl)} alt={asText(s.title)} className="aspect-[7/9] w-full bg-fa-sand object-cover" />
        </Reveal>
        <Reveal className="md:col-span-6 md:col-start-7">
          {asText(s.eyebrow) ? <p className="mb-5 text-[11px] uppercase tracking-[0.18em] text-fa-taupe">{asText(s.eyebrow)}</p> : null}
          <h2 className="font-display text-4xl leading-[1.05] md:text-6xl">{asText(s.title)}</h2>
          <div className="my-7 h-px w-12 bg-fa-ink" />
          {asText(s.text) ? <p className="text-lg leading-relaxed text-fa-taupe">{asText(s.text)}</p> : null}
          {asText(s.text2) ? <p className="mt-4 text-lg leading-relaxed text-fa-taupe">{asText(s.text2)}</p> : null}
        </Reveal>
      </div>
    </section>
  );
}

function Lookbook({ s }: { s: S }) {
  const items = asItems(s.items).filter((i) => itemText(i, 'imageUrl'));
  const track = useRef<HTMLDivElement | null>(null);
  const [index, setIndex] = useState(0);
  if (items.length === 0) return null;
  const go = (delta: number) => {
    const el = track.current;
    if (!el) return;
    const slide = el.querySelector<HTMLElement>('[data-slide]');
    const width = slide ? slide.offsetWidth + 16 : el.clientWidth;
    el.scrollBy({ left: delta * width, behavior: 'smooth' });
  };
  return (
    <section data-section="lookbook" className="overflow-hidden bg-fa-sand/60 py-16 md:py-24">
      <Reveal className="mx-auto mb-8 flex max-w-6xl items-end justify-between gap-6 px-5 md:px-12">
        <div>
          {asText(s.eyebrow) ? <p className={EYEBROW}>{asText(s.eyebrow)}</p> : null}
          <h2 className="font-display text-4xl leading-none md:text-5xl">{asText(s.title)}</h2>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-[11px] uppercase tracking-[0.18em] text-fa-taupe sm:inline">
            {String(index + 1).padStart(2, '0')} / {String(items.length).padStart(2, '0')}
          </span>
          <button type="button" aria-label="আগের ছবি" onClick={() => go(-1)} disabled={index === 0} className="flex h-11 w-11 items-center justify-center border border-fa-ink disabled:opacity-30">
            <LpIcon name="left" className="h-5 w-5" strokeWidth={1.25} />
          </button>
          <button type="button" aria-label="পরের ছবি" onClick={() => go(1)} disabled={index >= items.length - 1} className="flex h-11 w-11 items-center justify-center border border-fa-ink disabled:opacity-30">
            <LpIcon name="right" className="h-5 w-5" strokeWidth={1.25} />
          </button>
        </div>
      </Reveal>
      <div className="mx-auto max-w-6xl px-5 md:px-12">
        <div
          ref={track}
          tabIndex={0}
          role="region"
          aria-label="লুকবুক স্লাইডার"
          onScroll={(e) => {
            const el = e.currentTarget;
            const slide = el.querySelector<HTMLElement>('[data-slide]');
            if (slide) setIndex(Math.round(el.scrollLeft / (slide.offsetWidth + 16)));
          }}
          className="flex snap-x snap-mandatory gap-4 overflow-x-auto [scrollbar-width:none] focus:outline-none focus-visible:ring-2 focus-visible:ring-fa-rose [&::-webkit-scrollbar]:hidden"
        >
          {items.map((item, i) => (
            <figure key={i} data-slide="" className="w-[78%] shrink-0 snap-start sm:w-[46%] lg:w-[30%]">
              <Pic src={itemText(item, 'imageUrl')} alt={itemText(item, 'caption')} className="aspect-[3/4] w-full bg-fa-sand object-cover" />
              <figcaption className="flex items-baseline justify-between pt-3">
                <span className="text-[11px] uppercase tracking-[0.18em] text-fa-taupe">{itemText(item, 'label')}</span>
                <span className="font-display text-lg">{itemText(item, 'caption')}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Size charts in cm with an inches switch; used in the section and the product cards' dialog. */
function SizeTables({ tables, note }: { tables: LandingItem[]; note: string }) {
  const [unit, setUnit] = useState<'cm' | 'in'>('cm');
  const show = (value: string) => {
    const n = Number(value);
    if (unit === 'cm' || !Number.isFinite(n) || value === '') return value;
    return (Math.round((n / 2.54) * 10) / 10).toString();
  };
  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-4">
        <p className="text-[11px] uppercase tracking-[0.18em] text-fa-taupe">একক</p>
        <div className="inline-flex border border-fa-ink" role="group" aria-label="একক">
          {(['cm', 'in'] as const).map((u) => (
            <button key={u} type="button" aria-pressed={unit === u} onClick={() => setUnit(u)} className={`h-10 px-4 text-sm ${unit === u ? 'bg-fa-ink text-fa-ivory' : ''}`}>
              {u === 'cm' ? 'সেমি' : 'ইঞ্চি'}
            </button>
          ))}
        </div>
      </div>
      {tables.map((table, t) => {
        const columns = itemText(table, 'columns').split(',').map((c) => c.trim()).filter(Boolean);
        const rows = itemText(table, 'rows')
          .split('\n')
          .map((r) => r.split(',').map((c) => c.trim()))
          .filter((r) => r.some(Boolean));
        return (
          <div key={t} className="mb-8">
            <h3 className="mb-2 font-display text-2xl">
              {itemText(table, 'title')} {itemText(table, 'subtitle') ? <span className="text-base text-fa-taupe">· {itemText(table, 'subtitle')}</span> : null}
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[360px] text-center text-sm">
                <thead>
                  <tr className="border-b border-fa-ink text-[11px] uppercase tracking-[0.14em] text-fa-taupe">
                    {columns.map((c, i) => (
                      <th key={i} className={`py-3 font-medium ${i === 0 ? 'text-left' : ''}`}>
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, r) => (
                    <tr key={r} className="border-b border-fa-line">
                      {row.map((cell, c) =>
                        c === 0 ? (
                          <th key={c} className="py-3 text-left font-medium">
                            {cell}
                          </th>
                        ) : (
                          <td key={c}>{show(cell)}</td>
                        ),
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
      {note ? <p className="mt-5 text-sm text-fa-taupe">{note}</p> : null}
    </div>
  );
}

function ProductCard({ product, addLabel, onSizeGuide }: { product: LandingProduct; addLabel: string; onSizeGuide: (() => void) | null }) {
  const { addLine, currency } = useLanding();
  const [variantId, setVariantId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [added, setAdded] = useState(false);
  const variant = product.variants.find((v) => v.id === variantId);
  const price = variant?.price ?? product.price;
  const compareAt = variant ? variant.compareAt : product.compareAt;
  const off = discountPercent(price, compareAt);
  const add = () => {
    if (product.variants.length > 0 && !variant) {
      setError('সাইজ বাছাই করুন');
      return;
    }
    setError('');
    addLine(product.id, variant?.id ?? null);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1600);
  };
  return (
    <Reveal as="article">
      <div className="group relative block aspect-[4/5] w-full overflow-hidden bg-fa-sand">
        <Pic src={product.imageUrl ?? ''} alt={product.name} className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
        {!product.available ? <span className="absolute inset-x-0 bottom-0 bg-fa-ink/80 py-1.5 text-center text-xs tracking-widest text-fa-ivory">স্টক শেষ</span> : null}
      </div>
      <div className="pt-4">
        {product.note ? <p className="text-[11px] uppercase tracking-[0.18em] text-fa-taupe">{product.note}</p> : null}
        <h3 className="mt-1 font-display text-2xl leading-tight">{product.name}</h3>
        <p className="mt-1 flex items-baseline gap-2">
          <span className="font-semibold">{money(price, currency)}</span>
          {compareAt && compareAt > price ? <span className="text-sm text-fa-taupe line-through">{money(compareAt, currency)}</span> : null}
          {off > 0 ? <span className="text-xs text-fa-rose">-{toBn(off)}%</span> : null}
        </p>
        {product.variants.length > 0 ? (
          <>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-[0.18em] text-fa-taupe">সাইজ</span>
              {onSizeGuide ? (
                <button type="button" onClick={onSizeGuide} className="py-2 text-sm text-fa-taupe underline underline-offset-4 hover:text-fa-ink">
                  সাইজ গাইড
                </button>
              ) : null}
            </div>
            <div role="radiogroup" aria-label="সাইজ" className="flex flex-wrap gap-2">
              {product.variants.map((v) => (
                <label key={v.id} className={v.available ? 'cursor-pointer' : 'cursor-not-allowed opacity-40'}>
                  <input
                    type="radio"
                    name={`size-${product.id}`}
                    value={v.id}
                    checked={variantId === v.id}
                    disabled={!v.available}
                    onChange={() => {
                      setVariantId(v.id);
                      setError('');
                    }}
                    className="peer sr-only"
                  />
                  <span className="flex h-11 min-w-[44px] items-center justify-center border border-fa-line px-3 text-sm hover:border-fa-ink peer-checked:border-fa-ink peer-checked:bg-fa-ink peer-checked:text-fa-ivory peer-focus-visible:ring-2 peer-focus-visible:ring-fa-rose">
                    {v.name}
                  </span>
                </label>
              ))}
            </div>
          </>
        ) : null}
        {error ? (
          <p role="alert" className="mt-2 text-sm text-fa-error">
            {error}
          </p>
        ) : null}
        <button type="button" onClick={add} disabled={!product.available} className="mt-4 h-12 w-full bg-fa-ink text-sm tracking-widest text-fa-ivory transition-colors hover:bg-fa-charcoal disabled:opacity-40">
          {!product.available ? 'স্টক শেষ' : added ? '✓ যোগ হয়েছে' : addLabel}
        </button>
      </div>
    </Reveal>
  );
}

function Products({ s }: { s: S }) {
  const { products, settings } = useLanding();
  const dialog = useRef<HTMLDialogElement | null>(null);
  const guide = settings('size_guide');
  const tables = asItems(guide?.tables);
  const openGuide = tables.length > 0 ? () => dialog.current?.showModal() : null;
  return (
    <section data-section="products" className="px-5 py-20 md:px-12 md:py-28">
      <div className="mx-auto max-w-6xl">
        <Reveal className="mb-12 max-w-xl">
          {asText(s.eyebrow) ? <p className={EYEBROW}>{asText(s.eyebrow)}</p> : null}
          <h2 className="font-display text-4xl leading-none md:text-6xl">{asText(s.title)}</h2>
          {asText(s.subtitle) ? <p className="mt-4 text-fa-taupe">{asText(s.subtitle)}</p> : null}
        </Reveal>
        <div className="grid grid-cols-1 gap-x-6 gap-y-14 sm:grid-cols-2 lg:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} addLabel={asText(s.addLabel) || 'যোগ করুন'} onSizeGuide={openGuide} />
          ))}
        </div>
        {asText(s.note) ? <p className="mt-12 text-center text-sm text-fa-taupe">{asText(s.note)}</p> : null}
      </div>
      {openGuide ? (
        <dialog ref={dialog} aria-labelledby="lp-size-title" className="max-h-[88vh] w-[calc(100%-24px)] max-w-2xl overflow-hidden border border-fa-ink bg-fa-ivory p-0 text-fa-ink backdrop:bg-black/60">
          <div className="flex items-center justify-between border-b border-fa-line px-5 py-4">
            <h2 id="lp-size-title" className="font-display text-3xl">
              সাইজ গাইড
            </h2>
            <button type="button" aria-label="বন্ধ করুন" onClick={() => dialog.current?.close()} className="-mr-2 flex h-11 w-11 items-center justify-center">
              <LpIcon name="x" className="h-6 w-6" strokeWidth={1.25} />
            </button>
          </div>
          <div className="max-h-[calc(88vh-80px)] overflow-y-auto p-5">
            <SizeTables tables={tables} note={asText(guide?.note)} />
          </div>
        </dialog>
      ) : null}
    </section>
  );
}

function FabricDetails({ s }: { s: S }) {
  return (
    <section data-section="fabric_details" className="bg-fa-ink px-5 py-20 text-fa-ivory md:px-12 md:py-28">
      <div className="mx-auto max-w-6xl">
        {asText(s.eyebrow) ? <p className="mb-3 text-[11px] uppercase tracking-[0.18em] text-fa-rose-light">{asText(s.eyebrow)}</p> : null}
        <h2 className="mb-14 font-display text-4xl leading-none md:text-5xl">{asText(s.title)}</h2>
        <div className="grid gap-10 md:grid-cols-3 md:gap-12">
          {asItems(s.items).map((item, i) => (
            <Reveal key={i}>
              <LpIcon name={itemText(item, 'icon')} className="h-8 w-8 text-fa-rose-light" strokeWidth={1.25} />
              <h3 className="mt-5 font-display text-2xl">{itemText(item, 'title')}</h3>
              <div className="my-4 h-px w-8 bg-fa-rose-light" />
              <p className="leading-relaxed text-fa-ivory/75">{itemText(item, 'text')}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function SizeGuide({ s }: { s: S }) {
  const tables = asItems(s.tables);
  if (tables.length === 0) return null;
  return (
    <section data-section="size_guide" className="px-5 py-20 md:px-12 md:py-28">
      <Reveal className="mx-auto max-w-3xl">
        {asText(s.eyebrow) ? <p className={EYEBROW}>{asText(s.eyebrow)}</p> : null}
        <h2 className="mb-10 font-display text-4xl leading-none md:text-5xl">{asText(s.title)}</h2>
        <SizeTables tables={tables} note={asText(s.note)} />
      </Reveal>
    </section>
  );
}

function Reviews({ s }: { s: S }) {
  return (
    <section data-section="reviews" className="bg-fa-sand/60 px-5 py-20 md:px-12 md:py-28">
      <div className="mx-auto max-w-6xl">
        {asText(s.eyebrow) ? <p className={EYEBROW}>{asText(s.eyebrow)}</p> : null}
        <h2 className="mb-12 font-display text-4xl leading-none md:text-5xl">{asText(s.title)}</h2>
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {asItems(s.items).map((review, i) => (
            <Reveal key={i} as="figure">
              {itemText(review, 'imageUrl') ? <Pic src={itemText(review, 'imageUrl')} alt={`${itemText(review, 'name')} পোশাক পরে`} className="aspect-[4/5] w-full bg-fa-sand object-cover" /> : null}
              <figcaption className="pt-4">
                <span className="text-fa-rose">
                  <Stars rating={Number(review.rating)} className="h-4 w-4" />
                </span>
                <p className="mt-2 leading-relaxed">{itemText(review, 'text')}</p>
                <p className="mt-3 text-sm text-fa-taupe">
                  <span className="font-semibold text-fa-ink">{itemText(review, 'name')}</span>
                  {itemText(review, 'location') ? `, ${itemText(review, 'location')}` : ''}
                  {itemText(review, 'product') ? ` · ${itemText(review, 'product')}` : ''}
                </p>
              </figcaption>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Faq({ s }: { s: S }) {
  return (
    <section data-section="faq" className="px-5 py-20 md:px-12 md:py-28">
      <div className="mx-auto max-w-3xl">
        {asText(s.eyebrow) ? <p className={EYEBROW}>{asText(s.eyebrow)}</p> : null}
        <h2 className="mb-10 font-display text-4xl leading-none md:text-5xl">{asText(s.title)}</h2>
        <div className="border-t border-fa-ink">
          <FaqList
            items={asItems(s.items)}
            skin={{
              item: 'border-b border-fa-line',
              button: 'flex min-h-[56px] w-full items-center justify-between gap-4 py-5 text-left',
              question: 'font-medium',
              panel: 'pb-5 leading-relaxed text-fa-taupe',
              chevron: 'h-5 w-5',
            }}
          />
        </div>
      </div>
    </section>
  );
}

function Order({ s }: { s: S }) {
  return (
    <section data-section="order" className="bg-fa-sand/60 px-5 py-20 md:px-12 md:py-28">
      <div className="mx-auto max-w-5xl">
        {asText(s.eyebrow) ? <p className={EYEBROW}>{asText(s.eyebrow)}</p> : null}
        <h2 className="mb-10 font-display text-4xl leading-none md:text-5xl">{asText(s.title)}</h2>
        <LandingOrderForm
          layout="split"
          skin={ORDER_SKIN}
          texts={{ buttonLabel: asText(s.buttonLabel) || 'অর্ডার কনফার্ম করুন', note: asText(s.note), successText: asText(s.successText) }}
          products={
            <div>
              <p className={SANS_LABEL}>আপনার নির্বাচিত পোশাক</p>
              <CartList
                emptyText="উপরে থেকে পোশাক যোগ করুন"
                skin={{
                  box: 'border border-fa-ink bg-white px-4',
                  empty: 'py-10 text-center text-fa-taupe',
                  item: 'flex gap-3 border-b border-fa-line py-4 last:border-0',
                  image: 'h-24 w-[72px] shrink-0 bg-fa-sand object-cover',
                  name: 'font-display text-xl leading-tight',
                  variant: 'text-sm text-fa-taupe',
                  remove: '-mr-2 -mt-1 flex h-10 w-10 shrink-0 items-center justify-center text-fa-taupe hover:text-fa-error',
                  stepper: {
                    box: 'flex h-10 items-center border border-fa-ink',
                    button: 'h-full w-10 text-xl hover:bg-fa-sand disabled:opacity-40 disabled:hover:bg-transparent',
                    value: 'min-w-[32px] text-center font-semibold',
                  },
                  price: 'font-semibold',
                  oldPrice: 'text-xs text-fa-taupe line-through',
                }}
              />
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
  const links = [
    { href: asText(s.facebookUrl), icon: 'facebook', label: 'Facebook' },
    { href: asText(s.instagramUrl), icon: 'instagram', label: 'Instagram' },
  ].filter((l) => l.href);
  return (
    <footer data-section="footer" className="bg-fa-ink px-5 pb-28 pt-16 text-fa-ivory md:px-12 md:pb-12">
      <div className="mx-auto grid max-w-6xl items-end gap-10 md:grid-cols-2">
        <div>
          <p className="font-display text-4xl tracking-[0.3em]">{brand.toUpperCase()}</p>
          {asText(s.text) ? <p className="mt-3 max-w-sm text-fa-ivory/70">{asText(s.text)}</p> : null}
        </div>
        <div className="space-y-3 md:text-right">
          {phone ? (
            <a href={`tel:${phone.replace(/[^\d+]/g, '')}`} className="inline-flex min-h-[44px] items-center gap-2 text-lg">
              <LpIcon name="phone" className="h-5 w-5" strokeWidth={1.25} />
              {phone}
            </a>
          ) : null}
          {links.length > 0 ? (
            <div className="flex gap-2 md:justify-end">
              {links.map((l) => (
                <a key={l.icon} href={l.href} target="_blank" rel="noopener noreferrer" aria-label={l.label} className="flex h-11 w-11 items-center justify-center border border-fa-ivory/30 transition-colors hover:bg-fa-ivory hover:text-fa-ink">
                  <LpIcon name={l.icon} className="h-5 w-5" strokeWidth={1.25} />
                </a>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      <p className="mx-auto mt-12 max-w-6xl border-t border-fa-ivory/15 pt-6 text-xs text-fa-ivory/50">© {new Date().getFullYear()} {brand}। সর্বস্বত্ব সংরক্ষিত।</p>
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
      className={`fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-3 border-t border-fa-ivory/15 bg-fa-ink px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-fa-ivory transition-transform duration-300 md:hidden ${show ? 'translate-y-0' : 'invisible translate-y-full'}`}
    >
      <span className="text-sm" aria-live="polite">
        {count > 0 ? `${toBn(count)}টি পোশাক · ${money(total, currency)}` : 'কার্ট খালি'}
      </span>
      <button type="button" tabIndex={show ? 0 : -1} onClick={() => scrollTo(count > 0 ? 'order' : 'products')} className="h-11 bg-fa-ivory px-6 text-sm tracking-widest text-fa-ink">
        {count > 0 ? 'অর্ডার করুন' : 'কালেকশন দেখুন'}
      </button>
    </div>
  );
}

const SECTIONS: Record<string, (props: { s: S }) => ReactNode> = {
  hero: Hero,
  story: Story,
  lookbook: Lookbook,
  products: Products,
  fabric_details: FabricDetails,
  size_guide: SizeGuide,
  reviews: Reviews,
  faq: Faq,
  order: Order,
  footer: Footer,
};

export function FashionTemplate() {
  const { content } = useLanding();
  return (
    <div className="bg-fa-ivory font-sans text-fa-ink antialiased">
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
