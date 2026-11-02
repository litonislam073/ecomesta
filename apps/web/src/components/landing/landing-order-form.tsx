'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { LpIcon } from './landing-bits';
import { linePrice, money, useLanding } from './landing-context';
import { useLandingCheckout, type LandingFieldErrors } from './use-landing-checkout';

/** Class names a template gives the shared order form, so it matches the template's look. */
export interface OrderSkin {
  form: string;
  label: string;
  required?: string;
  input: string;
  inputInvalid: string;
  select: string;
  error: string;
  choice: string;
  choiceTitle: string;
  choiceHint: string;
  choicePrice: string;
  radio: string;
  summary: string;
  summaryLabel: string;
  summaryValue: string;
  totalLabel: string;
  totalValue: string;
  divider: string;
  savingValue: string;
  formError: string;
  button: string;
  note: string;
  success: { box: string; icon: string; title: string; text: string; total: string; link: string };
}

export interface OrderTexts {
  buttonLabel: string;
  note?: string;
  successText: string;
  closingText?: string;
}

function Field({ id, label, error, skin, children }: { id: string; label: string; error?: string; skin: OrderSkin; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className={skin.label}>
        {label} {skin.required ? <span className={skin.required}>*</span> : null}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className={skin.error}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * The order form every landing template uses: contact details, district and
 * thana, the store's delivery options and payment methods, a server-priced
 * total, then the thank-you message. `products` is the template's own picker
 * (variant and quantity, or the shopper's chosen products).
 */
export function LandingOrderForm({
  skin,
  texts,
  products,
  layout = 'stack',
  showSavings = false,
}: {
  skin: OrderSkin;
  texts: OrderTexts;
  products: ReactNode;
  layout?: 'stack' | 'split';
  showSavings?: boolean;
}) {
  const { lines, productById, currency, demo, store } = useLanding();
  const checkout = useLandingCheckout();
  const id = useId();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [errors, setErrors] = useState<LandingFieldErrors>({});
  const successRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (checkout.result) successRef.current?.focus();
  }, [checkout.result]);

  const estimate = lines.reduce(
    (sum, l) => {
      const { price, compareAt } = linePrice(productById(l.productId), l.variantId);
      sum.subtotal += price * l.quantity;
      if (compareAt && compareAt > price) sum.saving += (compareAt - price) * l.quantity;
      return sum;
    },
    { subtotal: 0, saving: 0 },
  );
  const quote = checkout.quote;
  // Only block while a quote is in flight; keep Confirm usable for field validation
  // when no quote is loaded yet (client estimate). Failures use quoteError separately.
  const pending = checkout.quoteLoading;
  const subtotal = quote ? Number(quote.subtotal) : estimate.subtotal;
  const discount = quote ? Number(quote.discountTotal) : 0;
  // No delivery option chosen yet (e.g. none for this place): not "free", just unknown.
  const shipping = quote && checkout.shippingMethodId ? Number(quote.shippingTotal) : null;
  const total = quote ? Number(quote.total) : estimate.subtotal;

  if (checkout.result) {
    const search = typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('store');
    const trackHref = `/track-order?ref=${encodeURIComponent(checkout.result.publicReference)}${search ? `&store=${encodeURIComponent(search)}` : ''}`;
    return (
      <div ref={successRef} tabIndex={-1} role="status" className={skin.success.box}>
        <span className={skin.success.icon}>
          <LpIcon name="check" className="h-9 w-9" />
        </span>
        <h3 className={skin.success.title}>ধন্যবাদ, {checkout.result.name}!</h3>
        <p className={skin.success.text}>{texts.successText}</p>
        <p className={skin.success.text}>
          অর্ডার নম্বর: <strong>{checkout.result.orderNumber}</strong> · মোবাইল: <strong>{checkout.result.phone}</strong>
        </p>
        <p className={skin.success.total}>সর্বমোট: {money(checkout.result.total, currency)}</p>
        {texts.closingText ? <p className={skin.success.text}>{texts.closingText}</p> : null}
        <a href={trackHref} className={skin.success.link}>
          অর্ডার ট্র্যাক করুন
        </a>
      </div>
    );
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const next = await checkout.submit({ name, phone, address });
    if (next === null) return;
    setErrors(next);
    const first = (['items', 'name', 'phone', 'address', 'district', 'upazila', 'shipping'] as const).find((k) => next[k]);
    if (first) {
      const el = document.getElementById(`${id}-${first}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) el.focus({ preventScroll: true });
    }
  }

  const clear = (key: keyof LandingFieldErrors) => setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
  const invalid = (key: keyof LandingFieldErrors) => (errors[key] ? skin.inputInvalid : '');

  const contact = (
    <>
      <Field id={`${id}-name`} label="আপনার নাম" error={errors.name} skin={skin}>
        <input
          id={`${id}-name`}
          type="text"
          autoComplete="name"
          placeholder="পুরো নাম লিখুন"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            clear('name');
          }}
          aria-invalid={!!errors.name}
          aria-describedby={errors.name ? `${id}-name-error` : undefined}
          maxLength={200}
          className={`${skin.input} ${invalid('name')}`}
        />
      </Field>
      <Field id={`${id}-phone`} label="মোবাইল নম্বর" error={errors.phone} skin={skin}>
        <input
          id={`${id}-phone`}
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          placeholder="01XXXXXXXXX"
          value={phone}
          onChange={(e) => {
            setPhone(e.target.value);
            clear('phone');
          }}
          aria-invalid={!!errors.phone}
          aria-describedby={errors.phone ? `${id}-phone-error` : undefined}
          maxLength={16}
          className={`${skin.input} ${invalid('phone')}`}
        />
      </Field>
      <Field id={`${id}-address`} label="পুরো ঠিকানা" error={errors.address} skin={skin}>
        <textarea
          id={`${id}-address`}
          rows={3}
          autoComplete="street-address"
          placeholder="বাসা/ফ্ল্যাট নম্বর, রোড, এলাকা"
          value={address}
          onChange={(e) => {
            setAddress(e.target.value);
            clear('address');
          }}
          aria-invalid={!!errors.address}
          aria-describedby={errors.address ? `${id}-address-error` : undefined}
          maxLength={200}
          className={`${skin.input} ${invalid('address')} h-auto resize-y py-3`}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${id}-district`} label="জেলা" error={errors.district} skin={skin}>
          <select
            id={`${id}-district`}
            value={checkout.districtId}
            onChange={(e) => {
              checkout.setDistrictId(e.target.value);
              clear('district');
              checkout.reportCheckoutStarted();
            }}
            aria-invalid={!!errors.district}
            className={`${skin.select} ${invalid('district')}`}
          >
            <option value="">জেলা বাছাই করুন</option>
            {checkout.districts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </Field>
        <Field id={`${id}-upazila`} label="থানা / উপজেলা" error={errors.upazila} skin={skin}>
          <select
            id={`${id}-upazila`}
            value={checkout.upazilaId}
            onChange={(e) => {
              checkout.setUpazilaId(e.target.value);
              clear('upazila');
            }}
            disabled={!checkout.districtId}
            aria-invalid={!!errors.upazila}
            className={`${skin.select} ${invalid('upazila')}`}
          >
            <option value="">{checkout.districtId ? 'থানা বাছাই করুন' : 'আগে জেলা বাছাই করুন'}</option>
            {checkout.upazilas.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
    </>
  );

  const delivery = (
    <fieldset id={`${id}-shipping`}>
      <legend className={skin.label}>ডেলিভারি</legend>
      {checkout.shippingMethods.length === 0 ? (
        <p className={skin.choiceHint}>{pending ? 'ডেলিভারি চার্জ হিসাব হচ্ছে…' : demo ? 'পণ্য বাছাই করলে ডেলিভারি চার্জ দেখাবে' : 'জেলা বাছাই করলে ডেলিভারি চার্জ দেখাবে'}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {checkout.shippingMethods.map((method) => {
            const amount = Number(method.amount ?? method.price);
            return (
              <label key={method.id} className={skin.choice}>
                <input
                  type="radio"
                  name={`${id}-shipping`}
                  value={method.id}
                  checked={checkout.shippingMethodId === method.id}
                  onChange={() => checkout.setShippingMethodId(method.id)}
                  className={skin.radio}
                />
                <span className="flex-1">
                  <span className={skin.choiceTitle}>{method.name}</span>
                  {method.estimatedDelivery ? <span className={skin.choiceHint}>{method.estimatedDelivery}</span> : null}
                </span>
                <span className={skin.choicePrice}>{amount === 0 ? 'ফ্রি' : money(amount, currency)}</span>
              </label>
            );
          })}
        </div>
      )}
      {errors.shipping ? (
        <p role="alert" className={skin.error}>
          {errors.shipping}
        </p>
      ) : null}
    </fieldset>
  );

  const payment =
    checkout.paymentChoices.length > 1 ? (
      <fieldset>
        <legend className={skin.label}>পেমেন্ট পদ্ধতি</legend>
        <div className="flex flex-col gap-3">
          {checkout.paymentChoices.map((choice) => (
            <label key={choice.key} className={skin.choice}>
              <input
                type="radio"
                name={`${id}-payment`}
                value={choice.key}
                checked={checkout.paymentKey === choice.key}
                onChange={() => checkout.setPaymentKey(choice.key)}
                className={skin.radio}
              />
              <span className="flex-1">
                <span className={skin.choiceTitle}>{choice.label}</span>
                <span className={skin.choiceHint}>{choice.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
    ) : checkout.paymentChoices.length === 1 ? (
      <p className={skin.choiceHint}>
        পেমেন্ট: <strong>{checkout.paymentChoices[0]!.label}</strong> ({checkout.paymentChoices[0]!.hint})
      </p>
    ) : null;

  const summary = (
    <div className={skin.summary} aria-live="polite">
      <div className="flex justify-between gap-4">
        <span className={skin.summaryLabel}>পণ্যের দাম</span>
        <span className={skin.summaryValue}>{money(subtotal, currency)}</span>
      </div>
      {showSavings && estimate.saving > 0 ? (
        <div className="flex justify-between gap-4">
          <span className={skin.summaryLabel}>আপনার সাশ্রয়</span>
          <span className={skin.savingValue}>{money(estimate.saving, currency)}</span>
        </div>
      ) : null}
      {discount > 0 ? (
        <div className="flex justify-between gap-4">
          <span className={skin.summaryLabel}>ছাড়</span>
          <span className={skin.savingValue}>-{money(discount, currency)}</span>
        </div>
      ) : null}
      <div className="flex justify-between gap-4">
        <span className={skin.summaryLabel}>ডেলিভারি চার্জ</span>
        <span className={skin.summaryValue}>{shipping === null ? '—' : shipping === 0 ? 'ফ্রি' : money(shipping, currency)}</span>
      </div>
      <div className={skin.divider} />
      <div className="flex items-baseline justify-between gap-4">
        <span className={skin.totalLabel}>সর্বমোট</span>
        <span className={skin.totalValue}>{pending && lines.length > 0 ? '…' : money(total, currency)}</span>
      </div>
      {checkout.quoteError ? <p className={skin.error}>{checkout.quoteError}</p> : null}
    </div>
  );

  const submit = (
    <div>
      {checkout.formError ? (
        <p role="alert" className={skin.formError}>
          {checkout.formError}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={checkout.submitting || pending || Boolean(checkout.quoteError)}
        className={skin.button}
        aria-busy={checkout.submitting || pending}
      >
        {checkout.submitting
          ? 'অর্ডার পাঠানো হচ্ছে…'
          : pending
            ? 'মোট দাম হিসাব হচ্ছে…'
            : texts.buttonLabel}
      </button>
      {texts.note ? <p className={skin.note}>{texts.note}</p> : null}
      <p className={`${skin.note} flex items-center justify-center gap-2`}>
        <LpIcon name="lock" className="h-4 w-4" />
        আপনার তথ্য শুধু অর্ডারের জন্য ব্যবহার করা হবে · {store.name}
      </p>
    </div>
  );

  const picker = (
    <div id={`${id}-items`} tabIndex={-1} onFocus={checkout.reportCheckoutStarted}>
      {products}
      {errors.items ? (
        <p role="alert" className={skin.error}>
          {errors.items}
        </p>
      ) : null}
    </div>
  );

  if (layout === 'split') {
    return (
      <form noValidate onSubmit={(e) => void onSubmit(e)} onFocus={checkout.reportCheckoutStarted} className={`grid gap-10 lg:grid-cols-2 lg:gap-14 ${skin.form}`}>
        <div className="flex flex-col gap-6">
          {contact}
          {delivery}
          {payment}
        </div>
        <div className="flex flex-col gap-6">
          {picker}
          {summary}
          {submit}
        </div>
      </form>
    );
  }

  return (
    <form noValidate onSubmit={(e) => void onSubmit(e)} onFocus={checkout.reportCheckoutStarted} className={`flex flex-col gap-6 ${skin.form}`}>
      {picker}
      {contact}
      {delivery}
      {payment}
      {summary}
      {submit}
    </form>
  );
}
