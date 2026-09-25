import { Button } from '@ecomesta/ui';

export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="rounded-lg border border-[var(--color-danger)]/30 bg-[#fff7f6] px-4 py-6 text-[var(--color-ink)]"
    >
      <h3 className="font-semibold">{title}</h3>
      {message ? <p className="mt-2 text-sm text-[var(--color-muted)]">{message}</p> : null}
      {onRetry ? (
        <Button className="mt-4" variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}
