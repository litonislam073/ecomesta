import { Badge } from '@/components/ui/badge';
import { statusTone } from '@/lib/admin-utils';

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={statusTone(status)}>{status}</Badge>;
}
