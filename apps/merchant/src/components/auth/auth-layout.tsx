import type { ReactNode } from "react";
import {
  MarketingShell,
  type MarketingCurrentPage,
} from "@ecomesta/ui/marketing";
import { marketingSiteUrl } from "@/lib/marketing-site";

interface AuthSplitProps {
  eyebrow: string;
  heading: string;
  description: string;
  points: string[];
  children: ReactNode;
}

const HIGHLIGHTS = [
  { value: "৳99", label: "Plans from, per month" },
  { value: "COD", label: "SSLCommerz & Stripe too" },
  { value: "64", label: "Districts with delivery charges" },
];

function CheckCircle() {
  return (
    <span
      aria-hidden="true"
      className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--brand-green)] text-white"
    >
      <svg
        viewBox="0 0 20 20"
        className="h-3 w-3"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 10.5l4 4 8-9" />
      </svg>
    </span>
  );
}

/** Navy brand panel beside the form; on small screens the form comes first. */
export function AuthSplit({
  eyebrow,
  heading,
  description,
  points,
  children,
}: AuthSplitProps) {
  return (
    <section className="relative isolate bg-[var(--brand-paper)]">
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_left,rgba(1,135,240,0.12),transparent_55%),radial-gradient(ellipse_at_bottom_right,rgba(3,165,129,0.10),transparent_50%)]"
      />
      <div className="mx-auto w-full max-w-[1200px] px-4 py-8 sm:px-6 sm:py-12 lg:py-16">
        <div className="grid overflow-hidden rounded-3xl border border-[var(--color-border)] bg-white shadow-[0_1px_2px_rgba(2,40,87,0.06),0_24px_56px_-24px_rgba(2,40,87,0.28)] lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)]">
          <div className="relative isolate order-2 overflow-hidden bg-gradient-to-br from-[var(--brand-navy-deep)] via-[var(--brand-navy)] to-[var(--brand-blue-deep)] px-6 py-10 text-white sm:px-10 lg:order-1 lg:px-12 lg:py-14">
            <div
              aria-hidden="true"
              className="absolute -right-24 -top-24 -z-10 h-72 w-72 rounded-full bg-[var(--brand-blue)] opacity-30 blur-3xl"
            />
            <div
              aria-hidden="true"
              className="absolute -bottom-28 -left-20 -z-10 h-72 w-72 rounded-full bg-[var(--brand-green)] opacity-25 blur-3xl"
            />
            <div
              aria-hidden="true"
              className="absolute inset-0 -z-10 opacity-[0.07] [background-image:radial-gradient(white_1px,transparent_1px)] [background-size:22px_22px]"
            />

            <div className="flex h-full flex-col">
              <p className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--brand-on-navy-accent)]">
                <span
                  aria-hidden="true"
                  className="h-1.5 w-1.5 rounded-full bg-[var(--brand-green)]"
                />
                {eyebrow}
              </p>
              <p className="mt-5 font-display text-3xl leading-tight tracking-tight sm:text-4xl">
                {heading}
              </p>
              <p className="mt-4 max-w-lg text-lg leading-relaxed text-[var(--brand-on-navy)]">
                {description}
              </p>

              <ul className="mt-8 space-y-3.5">
                {points.map((point) => (
                  <li
                    key={point}
                    className="flex gap-3 text-[15px] leading-relaxed text-white/90"
                  >
                    <CheckCircle />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>

              <ul className="mt-10 grid grid-cols-3 gap-3 border-t border-white/15 pt-8 lg:mt-auto">
                {HIGHLIGHTS.map((item) => (
                  <li
                    key={item.value}
                    className="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-3"
                  >
                    <p className="text-2xl font-bold tracking-tight text-white">
                      {item.value}
                    </p>
                    <p className="mt-1 text-xs leading-snug text-[var(--brand-on-navy)]">
                      {item.label}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="order-1 flex items-center px-6 py-8 sm:px-10 sm:py-12 lg:order-2 lg:px-12 lg:py-14">
            <div className="w-full">{children}</div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function AuthLayout({
  current,
  ...split
}: AuthSplitProps & { current?: MarketingCurrentPage }) {
  return (
    <MarketingShell
      siteOrigin={marketingSiteUrl()}
      loginHref="/login"
      registerHref="/register"
      current={current}
    >
      <AuthSplit {...split} />
    </MarketingShell>
  );
}
