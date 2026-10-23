'use client';

import type { DomainStatus, DomainVerificationRecord } from '@ecomesta/types';
import { CopyValue } from '@/components/domains/copy-value';

export interface DnsTargets {
  cname?: string | null;
  a?: string | null;
}

const INTRO: Partial<Record<DomainStatus, string>> = {
  PENDING:
    'Add this TXT record at your DNS provider, then run Verify. DNS changes can take a few minutes to propagate.',
  FAILED:
    'The last check did not find a matching TXT record. Confirm the record below, wait for propagation, then run Verify again.',
  VERIFIED:
    'Ownership is confirmed. Keep the TXT record in place until the domain is activated.',
};

/**
 * The record name is shown both fully-qualified and as the bare host label,
 * because registrars are split on which one they expect.
 *
 * `recordValue` is only available immediately after create/regenerate. When
 * missing, show a regenerate affordance instead of a secret from the server.
 */
export function DnsInstructions({
  hostname,
  status,
  verification,
  canRegenerate,
  regenerating,
  onRegenerate,
  targets,
}: {
  /** Where the domain should point once verified (CNAME host and/or apex A-record IPv4). */
  targets?: DnsTargets;
  hostname: string;
  status: DomainStatus;
  verification: DomainVerificationRecord;
  canRegenerate?: boolean;
  regenerating?: boolean;
  onRegenerate?: () => void;
}) {
  const hostLabel = verification.recordName.endsWith(`.${hostname}`)
    ? verification.recordName.slice(0, -(hostname.length + 1))
    : verification.recordName;

  return (
    <section
      aria-label={`DNS verification for ${hostname}`}
      className="space-y-3 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-3"
    >
      <div>
        <h4 className="text-sm font-semibold">DNS verification</h4>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          {INTRO[status] ?? INTRO.PENDING}
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <CopyValue label="Type" value={verification.recordType} />
        <CopyValue
          label="Host"
          value={hostLabel}
          hint={verification.recordName}
        />
        {verification.recordValue ? (
          <CopyValue label="Value" value={verification.recordValue} />
        ) : (
          <div className="space-y-1 text-sm">
            <p className="font-medium">Value</p>
            <p className="text-[var(--color-muted)]">
              Token shown once at create/regenerate. Regenerating invalidates
              the previous TXT value.
            </p>
            {canRegenerate && onRegenerate ? (
              <button
                type="button"
                disabled={regenerating}
                onClick={onRegenerate}
                className="rounded border border-[var(--color-border)] px-2.5 py-1 text-sm font-medium hover:bg-[var(--color-surface)] disabled:opacity-50"
              >
                {regenerating ? 'Regenerating…' : 'Regenerate token'}
              </button>
            ) : null}
          </div>
        )}
      </div>
      <div className="space-y-2">
        <p className="text-xs text-[var(--color-muted)]">
          Once ownership is verified, point{' '}
          <code className="font-mono">{hostname}</code> at the platform:
        </p>
        {targets?.cname || targets?.a ? (
          <div className="grid gap-3 md:grid-cols-2">
            {targets.cname ? (
              <CopyValue
                label="CNAME target"
                value={targets.cname}
                hint={`For subdomains such as ${hostname}`}
              />
            ) : null}
            {targets.a ? (
              <CopyValue
                label="A record target (apex domains)"
                value={targets.a}
                hint="Use this IPv4 address when a CNAME is not allowed"
              />
            ) : null}
          </div>
        ) : (
          <p className="text-xs text-[var(--color-muted)]">
            The CNAME / A record target for your deployment is not configured
            yet. Ask your platform administrator for it.
          </p>
        )}
      </div>
    </section>
  );
}
