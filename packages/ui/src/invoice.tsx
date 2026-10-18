'use client';

import { useEffect, type ReactNode } from 'react';

/**
 * Printable invoices. The sheet carries `data-invoice-sheet`; while one is on
 * screen, printing shows only the sheet (dashboard chrome and dialogs are
 * hidden), so "Print" doubles as "Save as PDF" in the browser's print dialog.
 */

const PRINT_CSS = `
@media print {
  @page { size: A4; margin: 12mm; }
  body * { visibility: hidden !important; }
  [data-invoice-sheet], [data-invoice-sheet] * { visibility: visible !important; }
  [data-invoice-sheet] {
    position: absolute !important; left: 0; top: 0; width: 100% !important;
    max-width: none !important; margin: 0 !important; border: 0 !important;
    box-shadow: none !important; border-radius: 0 !important;
  }
  [data-invoice-noprint] { display: none !important; }
}`;

export function InvoicePrintStyles() {
  return <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />;
}

/** `৳1,999.50` — two decimals only when there are paisa. */
export function formatInvoiceMoney(amount: number | string, currency = 'BDT'): string {
  const value = typeof amount === 'string' ? Number(amount) : amount;
  const safe = Number.isFinite(value) ? value : 0;
  const hasPaisa = Math.round(safe * 100) % 100 !== 0;
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: hasPaisa ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(safe);
  return currency === 'BDT' ? `৳${formatted}` : `${currency} ${formatted}`;
}

/** "19 Oct 2026" in Asia/Dhaka. */
export function formatInvoiceDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Dhaka',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(typeof date === 'string' ? new Date(date) : date);
}

function dhakaDateStamp(date: string | Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Dhaka',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(typeof date === 'string' ? new Date(date) : date);
  return parts.replace(/-/g, '');
}

/** Stable invoice number for an Ecomesta plan payment, e.g. ECM-20261019-3F2A9C1B. */
export function billingInvoiceNumber(payment: { id: string; createdAt: string }): string {
  return `ECM-${dhakaDateStamp(payment.createdAt)}-${payment.id.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
}

export interface InvoiceLine {
  description: string;
  detail?: string | null;
  quantity: number;
  unitPrice: number | string;
  total: number | string;
}

export interface InvoiceTotalRow {
  label: string;
  amount: number | string;
  /** Shown as a deduction (−৳…). */
  negative?: boolean;
}

export interface InvoiceParty {
  title: string;
  lines: Array<string | null | undefined | false>;
}

export interface InvoiceSheetProps {
  /** Seller block (top left). */
  sellerName: string;
  sellerLogoUrl?: string | null;
  sellerLines: Array<string | null | undefined | false>;
  heading?: string;
  invoiceNumber: string;
  meta: Array<{ label: string; value: string }>;
  /** e.g. PAID / DUE stamp next to the heading. */
  stamp?: { label: string; tone: 'paid' | 'due' | 'void' } | null;
  parties: InvoiceParty[];
  lines: InvoiceLine[];
  totals: InvoiceTotalRow[];
  grandTotal: InvoiceTotalRow;
  currency?: string;
  notes?: ReactNode;
  footer?: ReactNode;
}

const STAMP_STYLE: Record<'paid' | 'due' | 'void', string> = {
  paid: 'border-[#1f7a4d] text-[#1f7a4d]',
  due: 'border-[#b54708] text-[#b54708]',
  void: 'border-[#6b7280] text-[#6b7280]',
};

function compact(lines: Array<string | null | undefined | false>): string[] {
  return lines.filter((line): line is string => typeof line === 'string' && line.trim().length > 0);
}

export function InvoiceSheet({
  sellerName,
  sellerLogoUrl,
  sellerLines,
  heading = 'Invoice',
  invoiceNumber,
  meta,
  stamp,
  parties,
  lines,
  totals,
  grandTotal,
  currency = 'BDT',
  notes,
  footer,
}: InvoiceSheetProps) {
  return (
    <article
      data-invoice-sheet=""
      aria-label={`${heading} ${invoiceNumber}`}
      className="mx-auto w-full max-w-[210mm] rounded-lg border border-[#e5e7eb] bg-white p-6 text-[13px] leading-5 text-[#111827] shadow-sm sm:p-10"
    >
      <InvoicePrintStyles />
      <header className="flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-0">
          {sellerLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={sellerLogoUrl} alt={sellerName} className="mb-2 h-12 w-auto max-w-[200px] object-contain" />
          ) : null}
          <p className="text-lg font-bold">{sellerName}</p>
          {compact(sellerLines).map((line) => (
            <p key={line} className="whitespace-pre-line text-[#4b5563]">
              {line}
            </p>
          ))}
        </div>
        <div className="text-right">
          <div className="flex items-center justify-end gap-3">
            <h1 className="text-2xl font-bold uppercase tracking-wide">{heading}</h1>
            {stamp ? (
              <span className={`rounded border-2 px-2 py-0.5 text-xs font-bold uppercase tracking-wider ${STAMP_STYLE[stamp.tone]}`}>
                {stamp.label}
              </span>
            ) : null}
          </div>
          <p className="mt-1 font-mono text-sm">{invoiceNumber}</p>
          <dl className="mt-3 space-y-0.5">
            {meta.map((row) => (
              <div key={row.label} className="flex justify-end gap-2">
                <dt className="text-[#6b7280]">{row.label}:</dt>
                <dd className="font-medium">{row.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </header>

      {parties.length ? (
        <section className="mt-8 grid gap-6 sm:grid-cols-2">
          {parties.map((party) => (
            <div key={party.title}>
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[#6b7280]">{party.title}</h2>
              <div className="mt-1.5">
                {compact(party.lines).map((line, index) => (
                  <p key={`${index}-${line}`} className={index === 0 ? 'font-semibold' : 'text-[#374151]'}>
                    {line}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </section>
      ) : null}

      <table className="mt-8 w-full border-collapse">
        <thead>
          <tr className="border-b-2 border-[#111827] text-left text-[11px] uppercase tracking-wider text-[#6b7280]">
            <th className="py-2 pr-2 font-semibold">#</th>
            <th className="py-2 pr-2 font-semibold">Description</th>
            <th className="py-2 pr-2 text-right font-semibold">Qty</th>
            <th className="py-2 pr-2 text-right font-semibold">Unit price</th>
            <th className="py-2 text-right font-semibold">Amount</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, index) => (
            <tr key={index} className="border-b border-[#e5e7eb] align-top">
              <td className="py-2.5 pr-2 text-[#6b7280]">{index + 1}</td>
              <td className="py-2.5 pr-2">
                <p className="font-medium">{line.description}</p>
                {line.detail ? <p className="text-xs text-[#6b7280]">{line.detail}</p> : null}
              </td>
              <td className="py-2.5 pr-2 text-right">{line.quantity}</td>
              <td className="py-2.5 pr-2 text-right">{formatInvoiceMoney(line.unitPrice, currency)}</td>
              <td className="py-2.5 text-right font-medium">{formatInvoiceMoney(line.total, currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 flex justify-end">
        <dl className="w-full max-w-xs space-y-1">
          {totals.map((row) => (
            <div key={row.label} className="flex justify-between gap-4">
              <dt className="text-[#4b5563]">{row.label}</dt>
              <dd>
                {row.negative ? '−' : ''}
                {formatInvoiceMoney(row.amount, currency)}
              </dd>
            </div>
          ))}
          <div className="mt-2 flex justify-between gap-4 border-t-2 border-[#111827] pt-2 text-base font-bold">
            <dt>{grandTotal.label}</dt>
            <dd>{formatInvoiceMoney(grandTotal.amount, currency)}</dd>
          </div>
        </dl>
      </div>

      {notes ? <section className="mt-8 rounded-md bg-[#f9fafb] p-4 text-[#374151]">{notes}</section> : null}

      <footer className="mt-10 border-t border-[#e5e7eb] pt-4 text-center text-xs text-[#6b7280]">
        {footer ?? 'Thank you for your business.'}
      </footer>
    </article>
  );
}

/** Print / close buttons shown above an invoice; hidden on paper. */
export function InvoiceToolbar({ children, onClose }: { children?: ReactNode; onClose?: () => void }) {
  return (
    <div data-invoice-noprint="" className="mx-auto mb-4 flex w-full max-w-[210mm] flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap items-center gap-2">{children}</div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 rounded-md bg-[#111827] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1f2937]"
        >
          Print / Save as PDF
        </button>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-[#d1d5db] bg-white px-4 py-2 text-sm font-medium text-[#111827] hover:bg-[#f3f4f6]"
          >
            Close
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** Full-screen overlay holding an invoice (Escape closes it). */
export function InvoiceDialog({ children, onClose, label }: { children: ReactNode; onClose: () => void; label: string }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div role="dialog" aria-modal="true" aria-label={label} className="fixed inset-0 z-50 overflow-y-auto bg-black/50 px-3 py-6 sm:px-6">
      <InvoiceToolbar onClose={onClose} />
      {children}
    </div>
  );
}

const WALLET_LABEL: Record<string, string> = { BKASH: 'bKash', NAGAD: 'Nagad', ROCKET: 'Rocket', UPAY: 'Upay' };
const CYCLE_LABEL: Record<string, { label: string; months: number }> = {
  MONTHLY: { label: 'Monthly', months: 1 },
  SEMI_ANNUAL: { label: '6 months', months: 6 },
  YEARLY: { label: 'Yearly', months: 12 },
};

export interface BillingInvoicePayment {
  id: string;
  planName: string;
  billingCycle: string;
  amount: number;
  listAmount: number | null;
  discountAmount: number;
  couponCode: string | null;
  method: string;
  senderNumber: string;
  transactionId: string;
  status: string;
  createdAt: string;
  reviewedAt: string | null;
}

export const ECOMESTA_SELLER = {
  name: 'Ecomesta',
  logoUrl: '/brand/ecomesta-logo.png',
  lines: ['Dhaka, Bangladesh', 'support@ecomesta.com', '09697-493407', 'ecomesta.com'],
};

/** Invoice for a plan payment a merchant made to Ecomesta. */
export function BillingInvoice({
  payment,
  billedTo,
}: {
  payment: BillingInvoicePayment;
  billedTo: { name: string; email?: string | null; contactName?: string | null };
}) {
  const cycle = CYCLE_LABEL[payment.billingCycle] ?? { label: payment.billingCycle, months: 1 };
  const listAmount = payment.listAmount ?? payment.amount;
  const paid = payment.status === 'APPROVED';
  const wallet = WALLET_LABEL[payment.method] ?? payment.method;

  return (
    <InvoiceSheet
      sellerName={ECOMESTA_SELLER.name}
      sellerLogoUrl={ECOMESTA_SELLER.logoUrl}
      sellerLines={ECOMESTA_SELLER.lines}
      invoiceNumber={billingInvoiceNumber(payment)}
      stamp={
        paid
          ? { label: 'Paid', tone: 'paid' }
          : payment.status === 'REJECTED'
            ? { label: 'Void', tone: 'void' }
            : { label: 'Awaiting confirmation', tone: 'due' }
      }
      meta={[
        { label: 'Invoice date', value: formatInvoiceDate(payment.createdAt) },
        ...(paid && payment.reviewedAt ? [{ label: 'Paid on', value: formatInvoiceDate(payment.reviewedAt) }] : []),
      ]}
      parties={[
        { title: 'Billed to', lines: [billedTo.name, billedTo.contactName, billedTo.email] },
        {
          title: 'Payment',
          lines: [`${wallet} (mobile wallet)`, `From ${payment.senderNumber}`, `TrxID ${payment.transactionId}`],
        },
      ]}
      lines={[
        {
          description: `Ecomesta ${payment.planName} plan`,
          detail: `${cycle.label} subscription · ${cycle.months} month${cycle.months === 1 ? '' : 's'}`,
          quantity: 1,
          unitPrice: listAmount,
          total: listAmount,
        },
      ]}
      totals={[
        { label: 'Subtotal', amount: listAmount },
        ...(payment.discountAmount > 0
          ? [{ label: `Coupon${payment.couponCode ? ` (${payment.couponCode})` : ''}`, amount: payment.discountAmount, negative: true }]
          : []),
      ]}
      grandTotal={{ label: paid ? 'Total paid' : 'Total', amount: payment.amount }}
      footer="Thank you for choosing Ecomesta. Questions about this invoice? Email support@ecomesta.com."
    />
  );
}
