import Link from 'next/link';

const PLANNED: { title: string; text: string }[] = [
  { title: 'Campaign pages', text: 'A page for an Eid sale, a new collection or one hero product — separate from your homepage.' },
  { title: 'Ready-made sections', text: 'Hero, product highlights, reviews, FAQ, countdown and order button, arranged by drag and drop.' },
  { title: 'Order from the page', text: 'Shoppers order right there with cash on delivery or online payment.' },
  { title: 'Made for ads', text: 'Share the link in Facebook and Google ads; your Pixel and Analytics track every visit.' },
];

export default function LandingPagesPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight">Landing page</h1>
        <span className="rounded-full bg-[#fff1d6] px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-[#8a5a00]">
          Coming soon
        </span>
      </div>

      <section
        aria-labelledby="landing-coming-soon"
        className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-gradient-to-br from-[#0f3d30] via-[#145240] to-[#1b6b53] px-6 py-10 text-white sm:px-10"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/70">We&apos;re building it</p>
        <h2 id="landing-coming-soon" className="mt-2 max-w-2xl text-2xl font-semibold sm:text-3xl">
          Landing pages that turn ad clicks into orders
        </h2>
        <p className="mt-3 max-w-2xl text-white/80">
          Soon you&apos;ll be able to build focused pages for your campaigns and products — no code needed. We&apos;ll let you
          know here as soon as it&apos;s ready.
        </p>
      </section>

      <section aria-labelledby="landing-planned" className="space-y-3">
        <h2 id="landing-planned" className="text-lg font-semibold">What&apos;s coming</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {PLANNED.map((item) => (
            <li key={item.title} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
              <p className="font-semibold text-[var(--color-ink)]">{item.title}</p>
              <p className="mt-1 text-sm text-[var(--color-muted)]">{item.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <p className="text-sm text-[var(--color-muted)]">
        Meanwhile, you can shape your storefront in{' '}
        <Link href="/dashboard/theme" className="font-medium text-[var(--color-accent)] hover:underline">
          Theme
        </Link>{' '}
        and run offers with{' '}
        <Link href="/dashboard/coupons" className="font-medium text-[var(--color-accent)] hover:underline">
          Coupons
        </Link>
        .
      </p>
    </div>
  );
}
