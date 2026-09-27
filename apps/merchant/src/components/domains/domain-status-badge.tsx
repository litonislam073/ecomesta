import type { DomainStatus } from '@ecomesta/types';
import { Badge } from '@/components/ui/badge';

const TONES: Record<DomainStatus, 'neutral' | 'success' | 'warning' | 'danger'> = {
  PENDING: 'warning',
  VERIFIED: 'neutral',
  ACTIVE: 'success',
  FAILED: 'danger',
  DISABLED: 'neutral',
};

const LABELS: Record<DomainStatus, string> = {
  PENDING: 'Pending',
  VERIFIED: 'Verified',
  ACTIVE: 'Active',
  FAILED: 'Failed',
  DISABLED: 'Disabled',
};

export function DomainStatusBadge({ status }: { status: DomainStatus }) {
  return <Badge tone={TONES[status]}>{LABELS[status]}</Badge>;
}
