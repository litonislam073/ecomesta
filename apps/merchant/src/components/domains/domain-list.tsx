'use client';

import type { StoreDomain } from '@ecomesta/types';
import { Badge } from '@/components/ui/badge';
import { DnsInstructions } from '@/components/domains/dns-instructions';
import { DomainStatusBadge } from '@/components/domains/domain-status-badge';

export type DomainAction =
  | 'verify'
  | 'activate'
  | 'set-primary'
  | 'disable'
  | 'delete'
  | 'regenerate-verification';

function formatDate(value: string | null): string | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function availableActions(domain: StoreDomain): DomainAction[] {
  if (domain.type === 'SUBDOMAIN') {
    // The platform subdomain is always active and can never be removed.
    return domain.isPrimary ? [] : ['set-primary'];
  }
  const actions: DomainAction[] = [];
  if (domain.status === 'PENDING' || domain.status === 'FAILED') {
    actions.push('verify');
  }
  if (domain.status === 'VERIFIED') {
    actions.push('activate');
  }
  if (domain.status === 'ACTIVE' && !domain.isPrimary) {
    actions.push('set-primary');
  }
  if (domain.status !== 'DISABLED') {
    actions.push('disable');
  }
  actions.push('delete');
  return actions;
}

const ACTION_LABELS: Record<DomainAction, string> = {
  verify: 'Verify',
  activate: 'Activate',
  'set-primary': 'Set primary',
  disable: 'Disable',
  delete: 'Delete',
  'regenerate-verification': 'Regenerate token',
};

function DomainCard({
  domain,
  canWrite,
  busy,
  onAction,
}: {
  domain: StoreDomain;
  canWrite: boolean;
  busy: boolean;
  onAction: (action: DomainAction, domain: StoreDomain) => void;
}) {
  const verifiedAt = formatDate(domain.verifiedAt);
  const actions = canWrite ? availableActions(domain) : [];

  return (
    <li className="space-y-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="break-all font-medium">{domain.hostname}</span>
            {domain.isPrimary ? <Badge tone="success">Primary</Badge> : null}
            <DomainStatusBadge status={domain.status} />
          </div>
          <p className="text-xs text-[var(--color-muted)]">
            {domain.type === 'SUBDOMAIN'
              ? 'Platform subdomain'
              : 'Custom domain'}
            {verifiedAt ? ` · Verified ${verifiedAt}` : ' · Not verified'}
          </p>
        </div>
        {actions.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {actions.map((action) => (
              <button
                key={action}
                type="button"
                disabled={busy}
                onClick={() => onAction(action, domain)}
                className={`rounded border px-2.5 py-1 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 ${
                  action === 'delete'
                    ? 'border-[var(--color-danger)]/40 text-[var(--color-danger)] hover:bg-[#fff7f6]'
                    : 'border-[var(--color-border)] text-[var(--color-ink)] hover:bg-[var(--color-bg)]'
                }`}
              >
                {ACTION_LABELS[action]}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {domain.verification ? (
        <DnsInstructions
          hostname={domain.hostname}
          status={domain.status}
          verification={domain.verification}
          canRegenerate={
            canWrite &&
            (domain.status === 'PENDING' ||
              domain.status === 'FAILED' ||
              domain.status === 'VERIFIED')
          }
          regenerating={busy}
          onRegenerate={() => onAction('regenerate-verification', domain)}
        />
      ) : null}
    </li>
  );
}

export function DomainList({
  domains,
  canWrite,
  busyDomainId,
  onAction,
}: {
  domains: StoreDomain[];
  canWrite: boolean;
  busyDomainId: string | null;
  onAction: (action: DomainAction, domain: StoreDomain) => void;
}) {
  return (
    <ul aria-label="Store domains" className="space-y-3">
      {domains.map((domain) => (
        <DomainCard
          key={domain.id}
          domain={domain}
          canWrite={canWrite}
          busy={busyDomainId === domain.id}
          onAction={onAction}
        />
      ))}
    </ul>
  );
}
