import Link from 'next/link';

/**
 * Shared by the marketing site and every storefront host, and embedded in every
 * page's payload, so it must stay static (no request headers): `/` is the right
 * way back on both surfaces.
 */
export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col justify-center px-4 py-16 text-center">
      <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight">
        Page not found
      </h1>
      <p className="mt-3 text-[var(--color-muted)]">
        The page you are looking for does not exist or is no longer available.
      </p>
      <p className="mt-6">
        <Link href="/" className="font-semibold text-[var(--color-accent)] underline-offset-4 hover:underline">
          Go to the homepage
        </Link>
      </p>
    </div>
  );
}
