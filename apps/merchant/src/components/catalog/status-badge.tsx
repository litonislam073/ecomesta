import type { ProductStatus } from '@ecomesta/types';
import { Badge } from '@/components/ui/badge';

export function StatusBadge({ status }: { status: ProductStatus | string }) {
  const tone =
    status === 'ACTIVE'
      ? 'success'
      : status === 'DRAFT'
        ? 'warning'
        : status === 'ARCHIVED'
          ? 'neutral'
          : 'neutral';
  return <Badge tone={tone}>{status}</Badge>;
}
