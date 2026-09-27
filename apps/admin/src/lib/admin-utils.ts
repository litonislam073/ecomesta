import type {
  BillingCycle,
  SubscriptionPhase,
  SubscriptionStatus,
  TenantRole,
} from '@ecomesta/types';
import { billingCycleDefinition, formatBdt } from '@ecomesta/utils';

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger';

/** Turns an ApiError (or anything thrown) into copy that is safe to show an operator. */
export function humanApiError(error: unknown, fallback: string): string {
  if (
    error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof (error as { message: unknown }).message === 'string'
  ) {
    const message = (error as { message: string }).message;
    if (message.includes('last active Super Admin')) {
      return `${message}. Promote another account first.`;
    }
    if (message.includes('do not have access') || message.includes('Insufficient')) {
      return 'This action requires the Super Admin platform role.';
    }
    return message;
  }
  return fallback;
}

export function statusTone(status: string): BadgeTone {
  switch (status) {
    case 'ACTIVE':
      return 'success';
    case 'TRIALING':
    case 'PENDING':
    case 'INVITED':
    case 'DRAFT':
    case 'PAST_DUE':
      return 'warning';
    case 'SUSPENDED':
    case 'CANCELLED':
    case 'EXPIRED':
      return 'danger';
    default:
      return 'neutral';
  }
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString();
}

export function displayName(user: {
  firstName?: string | null;
  lastName?: string | null;
  email: string;
}): string {
  return [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email;
}

/** Mirrors apps/api subscription-transitions.ts so the UI only offers legal moves. */
export const SUBSCRIPTION_TRANSITIONS: Record<
  SubscriptionStatus,
  SubscriptionStatus[]
> = {
  TRIALING: ['ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED'],
  ACTIVE: ['PAST_DUE', 'CANCELLED', 'EXPIRED'],
  PAST_DUE: ['ACTIVE', 'CANCELLED', 'EXPIRED'],
  CANCELLED: ['ACTIVE'],
  EXPIRED: ['ACTIVE'],
};

export function allowedSubscriptionTransitions(
  from: SubscriptionStatus,
): SubscriptionStatus[] {
  return SUBSCRIPTION_TRANSITIONS[from] ?? [];
}

export const SUBSCRIPTION_STATUSES: SubscriptionStatus[] = [
  'TRIALING',
  'ACTIVE',
  'PAST_DUE',
  'CANCELLED',
  'EXPIRED',
];

export const BILLING_CYCLES: BillingCycle[] = ['MONTHLY', 'SEMI_ANNUAL', 'YEARLY'];

export function billingCycleLabel(cycle: BillingCycle): string {
  return billingCycleDefinition(cycle).label;
}

const PHASE_LABELS: Record<SubscriptionPhase, string> = {
  TRIAL: 'Free trial',
  GRACE: 'Grace period (payment due)',
  LAPSED: 'Grace period ended',
  ACTIVE: 'Paid',
  SUSPENDED: 'Suspended (unpaid)',
  CANCELLED: 'Cancelled',
};

export function subscriptionPhaseLabel(phase: SubscriptionPhase): string {
  return PHASE_LABELS[phase] ?? phase;
}

export function phaseTone(phase: SubscriptionPhase): BadgeTone {
  if (phase === 'ACTIVE') return 'success';
  if (phase === 'TRIAL' || phase === 'GRACE') return 'warning';
  return 'danger';
}

/** Plan prices arrive as decimal strings ("999.00"); the platform bills in whole taka. */
export function formatPlanMoney(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  const amount = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(amount) ? formatBdt(amount) : '—';
}

export const TENANT_ROLES: TenantRole[] = ['OWNER', 'ADMIN', 'STAFF'];

export function isNonNegativeMoney(value: string): boolean {
  return /^\d+(\.\d{1,2})?$/.test(value.trim());
}

export function normalizeSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

const SENSITIVE_KEY_PATTERN = /token|password|secret|hash|credential|apikey|api_key/i;

/**
 * Audit metadata is free-form JSON written by many modules, so scrub anything that
 * could carry a credential before it reaches the DOM.
 */
export function redactMetadata(metadata: unknown): string {
  if (metadata === null || metadata === undefined) return '—';
  if (typeof metadata !== 'object') return String(metadata);
  const entries = Object.entries(metadata as Record<string, unknown>).map(
    ([key, value]) => {
      if (SENSITIVE_KEY_PATTERN.test(key)) return `${key}: [redacted]`;
      if (value !== null && typeof value === 'object') return `${key}: {…}`;
      return `${key}: ${String(value)}`;
    },
  );
  return entries.length > 0 ? entries.join(', ') : '—';
}

export function buildQuery(
  params: Record<string, string | number | undefined>,
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '') continue;
    search.set(key, String(value));
  }
  return search.toString();
}
