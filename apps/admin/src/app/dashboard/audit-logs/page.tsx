import { Suspense } from 'react';
import AuditLogsView from './audit-logs-view';
import { LoadingState } from '@/components/ui/loading-state';

export default function AuditLogsRoute() {
  return (
    <Suspense fallback={<LoadingState label="Loading audit logs" />}>
      <AuditLogsView />
    </Suspense>
  );
}
