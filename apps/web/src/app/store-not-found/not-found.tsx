export default function StoreNotFound() {
  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-4 py-16 text-center">
      <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight">
        Storefront not found
      </h1>
      <p className="mt-3 text-[var(--color-muted)]">
        No active store is served from this domain.
      </p>
      <p className="mt-6 text-sm text-[var(--color-muted)]">
        If you just added this domain, finish DNS verification and activate it
        in your Ecomesta dashboard. Changes can take a few minutes to take
        effect.
      </p>
    </div>
  );
}
