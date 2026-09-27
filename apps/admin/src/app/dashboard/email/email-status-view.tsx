'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { PageHeader } from '@/components/admin/page-header';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { formatDateTime, humanApiError } from '@/lib/admin-utils';
import { api } from '@/lib/api-client';

type DeliveryStatus = 'PENDING' | 'SENDING' | 'SENT' | 'FAILED' | 'SKIPPED';

interface EmailOverview {
  config: {
    mode: 'smtp' | 'console' | 'disabled';
    deliversEmail: boolean;
    fromEmail: string | null;
    fromName: string;
    supportEmail: string | null;
    appPublicUrl: string;
    merchantUrl: string;
    smtp: { host: string | null; port: number | null; secure: boolean; authConfigured: boolean } | null;
  };
  last7Days: Record<DeliveryStatus, number>;
  recent: Array<{
    id: string;
    eventType: string;
    status: DeliveryStatus;
    provider: string | null;
    attempts: number;
    errorCategory: string | null;
    createdAt: string;
    sentAt: string | null;
    nextAttemptAt: string | null;
  }>;
}

const STATUS_TONE: Record<DeliveryStatus, 'neutral' | 'success' | 'warning' | 'danger'> = {
  PENDING: 'neutral',
  SENDING: 'neutral',
  SENT: 'success',
  SKIPPED: 'warning',
  FAILED: 'danger',
};

const MODE_LABEL: Record<EmailOverview['config']['mode'], string> = {
  smtp: 'SMTP',
  console: 'Console (development, nothing is sent)',
  disabled: 'Disabled (nothing is sent)',
};

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 py-2 text-sm sm:grid-cols-[12rem_1fr] sm:gap-4">
      <dt className="text-[var(--color-muted)]">{label}</dt>
      <dd className="break-all">{children}</dd>
    </div>
  );
}

export default function EmailStatusView() {
  const [data, setData] = useState<EmailOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.get<{ success: true; data: EmailOverview }>('/admin/email');
      setData(result.data);
    } catch (err) {
      setError(humanApiError(err, 'Failed to load email status'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Email"
        description="Transactional email configuration and recent deliveries. Credentials are never shown here."
      />

      {loading ? <LoadingState label="Loading email status" /> : null}
      {!loading && error ? <ErrorState message={error} onRetry={() => void load()} /> : null}

      {!loading && !error && data ? (
        <>
          <Card
            title="Configuration"
            actions={
              <Badge tone={data.config.deliversEmail ? 'success' : 'warning'}>
                {data.config.deliversEmail ? 'Delivering email' : 'Not delivering email'}
              </Badge>
            }
          >
            <dl className="divide-y divide-[var(--color-border)]">
              <Row label="Provider">{MODE_LABEL[data.config.mode]}</Row>
              <Row label="From">
                {data.config.fromEmail ? `${data.config.fromName} <${data.config.fromEmail}>` : 'Not configured'}
              </Row>
              <Row label="Support email">{data.config.supportEmail ?? 'Not configured'}</Row>
              <Row label="Public site URL">{data.config.appPublicUrl}</Row>
              <Row label="Merchant app URL">{data.config.merchantUrl}</Row>
              {data.config.smtp ? (
                <>
                  <Row label="SMTP server">
                    {data.config.smtp.host ?? 'Not configured'}
                    {data.config.smtp.port ? `:${data.config.smtp.port}` : ''}
                  </Row>
                  <Row label="Connection">{data.config.smtp.secure ? 'TLS (implicit)' : 'STARTTLS required'}</Row>
                  <Row label="SMTP login">{data.config.smtp.authConfigured ? 'Configured' : 'Not configured'}</Row>
                </>
              ) : null}
            </dl>
          </Card>

          <Card title="Last 7 days">
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-5">
              {(Object.keys(STATUS_TONE) as DeliveryStatus[]).map((status) => (
                <div key={status}>
                  <dt className="text-xs uppercase tracking-wide text-[var(--color-muted)]">{status}</dt>
                  <dd className="text-2xl font-semibold tabular-nums">{data.last7Days[status] ?? 0}</dd>
                </div>
              ))}
            </dl>
          </Card>

          {data.recent.length === 0 ? (
            <EmptyState title="No emails yet" description="Deliveries appear here once merchants trigger emails." />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-[var(--color-border)] bg-[#f3f7f5] text-[var(--color-muted)]">
                  <tr>
                    <th className="px-4 py-3 font-medium">Created</th>
                    <th className="px-4 py-3 font-medium">Event</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Attempts</th>
                    <th className="px-4 py-3 font-medium">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent.map((row) => (
                    <tr key={row.id} className="border-b border-[var(--color-border)] last:border-b-0">
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-[var(--color-muted)]">
                        {formatDateTime(row.createdAt)}
                      </td>
                      <td className="px-4 py-3 font-medium">{row.eventType}</td>
                      <td className="px-4 py-3">
                        <Badge tone={STATUS_TONE[row.status]}>{row.status}</Badge>
                      </td>
                      <td className="px-4 py-3 tabular-nums">{row.attempts}</td>
                      <td className="px-4 py-3 text-xs text-[var(--color-muted)]">
                        {row.errorCategory ? `Error: ${row.errorCategory}` : null}
                        {row.status === 'FAILED' && row.nextAttemptAt
                          ? ` · retry ${formatDateTime(row.nextAttemptAt)}`
                          : null}
                        {row.sentAt ? `Sent ${formatDateTime(row.sentAt)}` : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
