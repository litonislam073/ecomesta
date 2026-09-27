export type ProvisioningStepState = 'done' | 'current' | 'pending';

export interface ProvisioningStep {
  label: string;
  state: ProvisioningStepState;
  detail?: string;
}

const STATE_TEXT: Record<ProvisioningStepState, string> = {
  done: 'completed',
  current: 'in progress',
  pending: 'pending',
};

function StepIndicator({ state }: { state: ProvisioningStepState }) {
  if (state === 'done') {
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)] text-white">
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3.5 8.5l3 3 6-7" />
        </svg>
      </span>
    );
  }
  if (state === 'current') {
    return (
      <span className="relative flex h-6 w-6 shrink-0 items-center justify-center">
        <span className="absolute inset-0 rounded-full border-2 border-[#cfe3dc] border-t-[var(--color-accent)] motion-safe:animate-spin" />
        <span className="h-2 w-2 rounded-full bg-[var(--color-accent)]" />
      </span>
    );
  }
  return <span className="h-6 w-6 shrink-0 rounded-full border-2 border-[var(--color-border)] bg-white" />;
}

/**
 * Vertical checklist for multi-step setup work. Each row states its status in
 * text (check / spinner / hollow ring are decorative), so completion never
 * depends on colour alone. Callers own the live region.
 */
export function ProvisioningSteps({ steps, label }: { steps: ProvisioningStep[]; label: string }) {
  return (
    <ol aria-label={label} className="space-y-4">
      {steps.map((step) => (
        <li key={step.label} className="flex gap-3">
          <span aria-hidden="true">
            <StepIndicator state={step.state} />
          </span>
          <div className="min-w-0 pt-0.5">
            <p
              className={
                step.state === 'pending'
                  ? 'text-sm text-[var(--color-muted)]'
                  : 'text-sm font-semibold text-[var(--color-ink)]'
              }
            >
              {step.label}
              <span className="sr-only"> ({STATE_TEXT[step.state]})</span>
            </p>
            {step.detail && step.state !== 'pending' ? (
              <p className="mt-0.5 break-words text-sm text-[var(--color-muted)]">{step.detail}</p>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Share of finished steps; decorative because the list carries the same information. */
export function ProvisioningBar({ steps }: { steps: ProvisioningStep[] }) {
  const done = steps.filter((step) => step.state === 'done').length;
  const share = steps.length ? Math.round((done / steps.length) * 100) : 0;
  return (
    <div aria-hidden="true" className="h-1.5 w-full overflow-hidden rounded-full bg-[#e4ebe8]">
      <div
        className="h-full rounded-full bg-[var(--color-accent)] motion-safe:transition-[width] motion-safe:duration-500"
        style={{ width: `${Math.max(share, 6)}%` }}
      />
    </div>
  );
}
