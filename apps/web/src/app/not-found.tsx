export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col justify-center px-4 text-center">
      <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight">
        Not found
      </h1>
      <p className="mt-3 text-[var(--color-muted)]">
        That page, product, or category is not available in this store.
      </p>
    </div>
  );
}
