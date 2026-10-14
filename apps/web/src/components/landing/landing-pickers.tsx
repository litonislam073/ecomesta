'use client';

import { useId } from 'react';
import { LpIcon } from './landing-bits';
import { MAX_QUANTITY, linePrice, money, useLanding, type LandingProduct } from './landing-context';

export interface PillSkin {
  group: string;
  /** Classes of the visible pill; the hidden radio before it is a `peer`. */
  pill: string;
  label?: string;
}

/** A product's variants as pill buttons (sizes, colours, packages). */
export function VariantPills({
  product,
  value,
  onChange,
  skin,
  label = 'বাছাই করুন',
}: {
  product: LandingProduct;
  value: string | null;
  onChange: (variantId: string) => void;
  skin: PillSkin;
  label?: string;
}) {
  const name = useId();
  if (product.variants.length === 0) return null;
  return (
    <fieldset>
      <legend className={skin.label ?? 'sr-only'}>{label}</legend>
      <div role="radiogroup" className={skin.group}>
        {product.variants.map((variant) => (
          <label key={variant.id} className={variant.available ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}>
            <input
              type="radio"
              name={name}
              value={variant.id}
              checked={value === variant.id}
              disabled={!variant.available}
              onChange={() => onChange(variant.id)}
              className="peer sr-only"
            />
            <span className={skin.pill}>{variant.name}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export interface StepperSkin {
  box: string;
  button: string;
  value: string;
}

export function QuantityStepper({ value, onChange, skin, label = 'পরিমাণ' }: { value: number; onChange: (next: number) => void; skin: StepperSkin; label?: string }) {
  return (
    <div className={skin.box} role="group" aria-label={label}>
      <button type="button" aria-label="পরিমাণ কমান" disabled={value <= 1} onClick={() => onChange(value - 1)} className={skin.button}>
        −
      </button>
      <span className={skin.value} aria-live="polite">
        {value}
      </span>
      <button type="button" aria-label="পরিমাণ বাড়ান" disabled={value >= MAX_QUANTITY} onClick={() => onChange(value + 1)} className={skin.button}>
        +
      </button>
    </div>
  );
}

export interface CartSkin {
  box: string;
  empty: string;
  item: string;
  image: string;
  name: string;
  variant: string;
  remove: string;
  stepper: StepperSkin;
  price: string;
  oldPrice: string;
}

/** The products a shopper added (multi-product templates). */
export function CartList({ skin, emptyText }: { skin: CartSkin; emptyText: string }) {
  const { lines, productById, changeQuantity, removeLine, currency } = useLanding();
  return (
    <div className={skin.box}>
      {lines.length === 0 ? (
        <p className={skin.empty}>{emptyText}</p>
      ) : (
        <ul>
          {lines.map((line) => {
            const product = productById(line.productId);
            const { price, compareAt, variantName } = linePrice(product, line.variantId);
            return (
              <li key={line.key} className={skin.item}>
                {product?.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={product.imageUrl} alt="" className={skin.image} />
                ) : (
                  <span className={skin.image} />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className={skin.name}>{product?.name}</div>
                      {variantName ? <div className={skin.variant}>{variantName}</div> : null}
                    </div>
                    <button type="button" aria-label={`${product?.name ?? ''} বাদ দিন`} onClick={() => removeLine(line.key)} className={skin.remove}>
                      <LpIcon name="trash" className="h-5 w-5" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between gap-3 pt-2">
                    <QuantityStepper value={line.quantity} onChange={(next) => changeQuantity(line.key, next - line.quantity)} skin={skin.stepper} />
                    <div className="text-right">
                      <div className={skin.price}>{money(price * line.quantity, currency)}</div>
                      {compareAt && compareAt > price ? <div className={skin.oldPrice}>{money(compareAt * line.quantity, currency)}</div> : null}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Total of the chosen products (before delivery), for the sticky bars. */
export function useLinesTotal() {
  const { lines, productById } = useLanding();
  return lines.reduce(
    (sum, l) => {
      sum.count += l.quantity;
      sum.total += linePrice(productById(l.productId), l.variantId).price * l.quantity;
      return sum;
    },
    { count: 0, total: 0 },
  );
}
