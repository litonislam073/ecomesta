'use client';

import { useState } from 'react';
import type { LandingItem, LandingValue } from '@ecomesta/utils';
import { Pic, Reveal } from './landing-bits';
import { asItems, itemText, linePrice, useLanding, useTimeLeft, type LandingProduct, type LandingVariant } from './landing-context';

/**
 * Pieces shared by the second set of templates (gadget, beauty, kids, home,
 * trend): the offer timer cells, the main product line, colour/size pickers
 * built from variant names and the before/after slider. Each template styles
 * them itself.
 */

export interface TimerSkin {
  box: string;
  cell: string;
  value: string;
  label: string;
}

const UNITS = ['দিন', 'ঘণ্টা', 'মিনিট', 'সেকেন্ড'] as const;

/** Days / hours / minutes / seconds as four cells; nothing when the page has no timer. */
export function TimerCells({ skin, ariaLabel = 'অফার শেষ হতে বাকি সময়', cellClasses }: { skin: TimerSkin; ariaLabel?: string; cellClasses?: string[] }) {
  const { countdownEnd } = useLanding();
  const t = useTimeLeft(countdownEnd);
  if (countdownEnd === null) return null;
  const values = [t.days, t.hours, t.minutes, t.seconds];
  return (
    <div className={skin.box} aria-label={ariaLabel}>
      {values.map((value, i) => (
        <div key={UNITS[i]} className={`${skin.cell} ${cellClasses?.[i] ?? ''}`}>
          <div className={skin.value}>{value}</div>
          <div className={skin.label}>{UNITS[i]}</div>
        </div>
      ))}
    </div>
  );
}

/** The single-product templates' product and the shopper's current choice. */
export function useMainLine() {
  const { products, lines, setOnlyLine } = useLanding();
  const product = products[0];
  const line = lines[0];
  const variantId = line?.variantId ?? null;
  const quantity = line?.quantity ?? 1;
  const { price, compareAt, variantName } = linePrice(product, variantId);
  return {
    product,
    line,
    variantId,
    quantity,
    price,
    compareAt,
    variantName,
    setVariant: (id: string | null) => product && setOnlyLine(product.id, id, quantity),
    setQuantity: (next: number) => product && setOnlyLine(product.id, variantId, next),
  };
}

const AXIS_SPLIT = /\s+\/\s+|\s*\|\s*/;

/** Variant names like "Black / L" as two choices (colour, size); null when they are not named that way. */
export function variantAxes(product: LandingProduct | undefined): { first: string[]; second: string[] } | null {
  if (!product || product.variants.length < 2) return null;
  const parts = product.variants.map((v) => v.name.split(AXIS_SPLIT).map((p) => p.trim()));
  if (!parts.every((p) => p.length === 2 && p[0] && p[1])) return null;
  const first = [...new Set(parts.map((p) => p[0]!))];
  const second = [...new Set(parts.map((p) => p[1]!))];
  return { first, second };
}

export function axisOf(name: string | null | undefined, index: 0 | 1): string {
  if (!name) return '';
  const parts = name.split(AXIS_SPLIT).map((p) => p.trim());
  return parts.length === 2 ? parts[index]! : index === 0 ? name : '';
}

/** The variant with these two values, or another available one in the same colour when it is sold out. */
export function findVariant(product: LandingProduct, first: string, second: string): LandingVariant | undefined {
  const exact = product.variants.find((v) => axisOf(v.name, 0) === first && axisOf(v.name, 1) === second);
  if (exact?.available) return exact;
  return product.variants.find((v) => axisOf(v.name, 0) === first && v.available) ?? exact ?? product.variants.find((v) => axisOf(v.name, 0) === first);
}

/** A colour swatch from the hero's list, matched by the variant's (first) name. */
export function swatchFor(swatches: LandingValue | undefined, name: string): LandingItem | undefined {
  const key = name.trim().toLowerCase();
  if (!key) return undefined;
  return asItems(swatches).find((s) => itemText(s, 'name').trim().toLowerCase() === key);
}

/** A swatch colour, only when it is a plain hex value. */
export function swatchHex(item: LandingItem | undefined): string | undefined {
  const hex = item ? itemText(item, 'hex').trim() : '';
  return /^#[0-9a-f]{6}$/i.test(hex) ? hex : undefined;
}

/** "a | b | c" as cells. */
export function cells(value: string): string[] {
  return value
    .split('|')
    .map((c) => c.trim())
    .filter((c, i, all) => c || i < all.length - 1);
}

/** Before / after photos with a drag handle (keyboard: arrow keys on the slider). */
export function BeforeAfterSlider({
  before,
  after,
  caption,
  beforeLabel = 'আগে',
  afterLabel = 'পরে',
  boxClass,
  imageClass,
  beforeTagClass,
  afterTagClass,
  captionClass,
}: {
  before: string;
  after: string;
  caption: string;
  beforeLabel?: string;
  afterLabel?: string;
  boxClass: string;
  imageClass: string;
  beforeTagClass: string;
  afterTagClass: string;
  captionClass: string;
}) {
  const [pos, setPos] = useState(50);
  return (
    <Reveal as="figure">
      <div className={`lp-ba relative select-none overflow-hidden ${boxClass}`} style={{ ['--pos' as string]: `${pos}%` }}>
        <Pic src={after} alt={`${caption}: পরের ছবি`} className={`block w-full object-cover ${imageClass}`} />
        <div className="lp-ba-before absolute inset-0">
          <Pic src={before} alt={`${caption}: আগের ছবি`} className="block h-full w-full object-cover" />
        </div>
        <span className={`absolute left-3 top-3 ${beforeTagClass}`}>{beforeLabel}</span>
        <span className={`absolute right-3 top-3 ${afterTagClass}`}>{afterLabel}</span>
        <div className="lp-ba-handle" aria-hidden="true">
          <span className="lp-ba-knob">⇄</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={pos}
          onChange={(e) => setPos(Number(e.target.value))}
          aria-label={`আগে ও পরের ছবি তুলনা করতে টানুন${caption ? ` (${caption})` : ''}`}
          className="absolute inset-0 m-0 h-full w-full cursor-ew-resize opacity-0"
        />
      </div>
      {caption ? <figcaption className={captionClass}>{caption}</figcaption> : null}
    </Reveal>
  );
}
