'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState, type ReactNode } from 'react';
import type { OffsetPageMeta } from '@ecomesta/types';
import { Button } from '@ecomesta/ui';
import { PageHeader } from '@/components/admin/page-header';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Input } from '@/components/ui/input';
import { LoadingState } from '@/components/ui/loading-state';
import { Pagination } from '@/components/ui/pagination';
import { Select } from '@/components/ui/select';
import { buildQuery, formatDateTime, humanApiError } from '@/lib/admin-utils';
import { api } from '@/lib/api-client';
import { useListRequest } from '@/lib/list-request';

type DeliveryStatus = 'PENDING' | 'SENDING' | 'SENT' | 'FAILED' | 'SKIPPED';

interface EmailConfig {
  mode: 'smtp' | 'console' | 'disabled';
  deliversEmail: boolean;
  fromEmail: string | null;
  fromName: string;
  supportEmail: string | null;
  appPublicUrl: string;
  merchantUrl: string;
  smtp: { host: string | null; port: number | null; secure: boolean; authConfigured: boolean } | null;
}

interface DeliveryListItem {
  id: string;
  eventType: string;
  status: DeliveryStatus;
  provider: string | null;
  attempts: number;
  errorCategory: string | null;
  errorMessage: string | null;
  subject: string;
  recipient: string | null;
  recipientName: string | null;
  createdAt: string;
  sentAt: string | null;
  nextAttemptAt: string | null;
}

interface DeliveryDetail extends DeliveryListItem {
  providerMessageId: string | null;
  userId: string | null;
  tenantId: string | null;
  storeId: string | null;
  failedAt: string | null;
  payload: Record<string, unknown> | null;
}

const STATUS_TONE: Record<DeliveryStatus, 'neutral' | 'success' | 'warning' | 'danger'> = {
  PENDING: 'neutral',
  SENDING: 'neutral',
  SENT: 'success',
  SKIPPED: 'warning',
  FAILED: 'danger',
};

const MODE_LABEL: Record<EmailConfig['mode'], string> = {
  smtp: 'SMTP',
  console: 'Console (development, nothing is sent)',
  disabled: 'Disabled (nothing is sent)',
};

const STATUSES: DeliveryStatus[] = ['PENDING', 'SENDING', 'SENT', 'FAILED', 'SKIPPED'];

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 py-2 text-sm sm:grid-cols-[12rem_1fr] sm:gap-4">
      <dt className="text-[var(--color-muted)]">{label}</dt>
      <dd className="break-all">{children}</dd>
    </div>
  );
}

export default function EmailStatusView() {
  const [config, setConfig] = useState<EmailConfig | null>(null);
  const [last7Days, setLast7Days] = useState<Record<DeliveryStatus, number> | null>(null);
  const [items, setItems] = useState<DeliveryListItem[]>([]);
  const [meta, setMeta] = useState<OffsetPageMeta | null>(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<DeliveryStatus | ''>('');
  const [eventType, setEventType] = useState('');
  const [eventQuery, setEventQuery] = useState('');
  const [detail, setDetail] = useState<DeliveryDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { begin } = useListRequest();

  const loadOverview = useCallback(async () => {
    setOverviewLoading(true);
    try {
      const result = await api.get<{
        success: true;
        data: { config: EmailConfig; last7Days: Record<DeliveryStatus, number> };
      }>('/admin/email');
      setConfig(result.data.config);
      setLast7Days(result.data.last7Days);
    } catch (err) {
      setError(humanApiError(err, 'Failed to load email status'));
    } finally {
      setOverviewLoading(false);
    }
  }, []);

  const loadDeliveries = useCallback(async () => {
    const req = begin();
    setLoading(true);
    setError(null);
    setItems([]);
    setMeta(null);
    try {
      const result = await api.get<{
        success: true;
        data: { items: DeliveryListItem[]; meta: OffsetPageMeta };
      }>(
        `/admin/email/deliveries?${buildQuery({
          page,
          limit: 20,
          status: status || undefined,
          eventType: eventQuery || undefined,
        })}`,
      );
      if (!req.isCurrent()) return;
      setItems(result.data.items);
      setMeta(result.data.meta);
    } catch (err) {
      if (!req.isCurrent()) return;
      setError(humanApiError(err, 'Failed to load email deliveries'));
    } finally {
      if (req.isCurrent()) setLoading(false);
    }
  }, [begin, page, status, eventQuery]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    void loadDeliveries();
  }, [loadDeliveries]);

  async function openDetail(id: string) {
    setDetailLoading(true);
    setDetail(null);
    try {
      const result = await api.get<{ success: true; data: DeliveryDetail }>(
        `/admin/email/deliveries/${id}`,
      );
      setDetail(result.data);
    } catch (err) {
      setError(humanApiError(err, 'Failed to load delivery detail'));
    } finally {
      setDetailLoading(false);
    }
  }

  function onFilter(event: FormEvent) {
    event.preventDefault();
    setPage(1);
    setEventQuery(eventType.trim());
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Email"
        description="Transactional email configuration and delivery log. Credentials are never shown here."
      />

      {overviewLoading ? <LoadingState label="Loading email status" /> : null}
      {!overviewLoading && error && !config ? (
        <ErrorState message={error} onRetry={() => void loadOverview()} />
      ) : null}

      {!overviewLoading && config && last7Days ? (
        <>
          <Card
            title="Configuration"
            actions={
              <Badge tone={config.deliversEmail ? 'success' : 'warning'}>
                {config.deliversEmail ? 'Delivering email' : 'Not delivering email'}
              </Badge>
            }
          >
            <dl className="divide-y divide-[var(--color-border)]">
              <Row label="Provider">{MODE_LABEL[config.mode]}</Row>
              <Row label="From">
                {config.fromEmail ? `${config.fromName} <${config.fromEmail}>` : 'Not configured'}
              </Row>
              <Row label="Support email">{config.supportEmail ?? 'Not configured'}</Row>
              <Row label="Public site URL">{config.appPublicUrl}</Row>
              <Row label="Merchant app URL">{config.merchantUrl}</Row>
              {config.smtp ? (
                <>
                  <Row label="SMTP server">
                    {config.smtp.host ?? 'Not configured'}
                    {config.smtp.port ? `:${config.smtp.port}` : ''}
                  </Row>
                  <Row label="Connection">{config.smtp.secure ? 'TLS (implicit)' : 'STARTTLS required'}</Row>
                  <Row label="SMTP login">{config.smtp.authConfigured ? 'Configured' : 'Not configured'}</Row>
                </>
              ) : null}
            </dl>
          </Card>

          <Card title="Last 7 days">
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-5">
              {STATUSES.map((entry) => (
                <div key={entry}>
                  <dt className="text-xs uppercase tracking-wide text-[var(--color-muted)]">{entry}</dt>
                  <dd className="text-2xl font-semibold tabular-nums">{last7Days[entry] ?? 0}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </>
      ) : null}

      <section aria-labelledby="deliveries-heading" className="space-y-4">
        <h2 id="deliveries-heading" className="text-lg font-semibold">
          Deliveries
        </h2>

        <form className="flex flex-wrap gap-2" onSubmit={onFilter}>
          <Select
            className="w-auto"
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value as DeliveryStatus | '');
            }}
            aria-label="Status filter"
          >
            <option value="">All statuses</option>
            {STATUSES.map((entry) => (
              <option key={entry} value={entry}>
                {entry}
              </option>
            ))}
          </Select>
          <Input
            className="max-w-xs"
            placeholder="Event type"
            value={eventType}
            onChange={(e) => setEventType(e.target.value)}
            aria-label="Event type filter"
          />
          <Button type="submit" variant="secondary">
            Search
          </Button>
        </form>

        {loading ? <LoadingState label="Loading deliveries" /> : null}
        {!loading && error ? (
          <ErrorState message={error} onRetry={() => void loadDeliveries()} />
        ) : null}
        {!loading && !error && items.length === 0 ? (
          <EmptyState
            title="No emails match"
            description="Try another status or event type, or wait for merchants to trigger emails."
          />
        ) : null}

        {!loading && !error && items.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
            <table className="min-w-[48rem] w-full text-left text-sm">
              <thead className="sticky top-14 z-10 border-b border-[var(--color-border)] bg-[#f3f7f5] text-[var(--color-muted)] shadow-[0_1px_0_0_var(--color-border)]">
                <tr>
                  <th className="px-4 py-3 font-medium">Created</th>
                  <th className="px-4 py-3 font-medium">Recipient</th>
                  <th className="px-4 py-3 font-medium">Subject</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Error</th>
                  <th className="px-4 py-3 font-medium">
                    <span className="sr-only">Open</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id} className="border-b border-[var(--color-border)] last:border-b-0">
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-[var(--color-muted)]">
                      {formatDateTime(row.createdAt)}
                    </td>
                    <td className="max-w-[12rem] truncate px-4 py-3" title={row.recipient ?? undefined}>
                      {row.recipient ?? <span className="text-[var(--color-muted)]">—</span>}
                    </td>
                    <td className="max-w-[16rem] truncate px-4 py-3" title={row.subject}>
                      {row.subject}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={STATUS_TONE[row.status]}>{row.status}</Badge>
                    </td>
                    <td className="max-w-[12rem] truncate px-4 py-3 text-xs text-[var(--color-muted)]">
                      {row.errorMessage ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button type="button" variant="secondary" onClick={() => void openDetail(row.id)}>
                        View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {!loading && meta ? (
          <Pagination page={meta.page} totalPages={meta.totalPages} onPageChange={setPage} />
        ) : null}
      </section>

      {detailLoading ? <LoadingState label="Loading delivery" /> : null}
      {detail ? (
        <Card
          title="Delivery detail"
          actions={
            <Button type="button" variant="ghost" onClick={() => setDetail(null)}>
              Close
            </Button>
          }
        >
          <dl className="divide-y divide-[var(--color-border)]">
            <Row label="Recipient">
              {detail.recipientName ? `${detail.recipientName} · ` : ''}
              {detail.recipient ?? '—'}
              {detail.userId ? (
                <>
                  {' '}
                  <Link
                    className="text-[var(--color-accent)] hover:underline"
                    href={`/dashboard/users/${detail.userId}`}
                  >
                    Open user
                  </Link>
                </>
              ) : null}
            </Row>
            <Row label="Subject">{detail.subject}</Row>
            <Row label="Event">{detail.eventType}</Row>
            <Row label="Status">
              <Badge tone={STATUS_TONE[detail.status]}>{detail.status}</Badge>
            </Row>
            <Row label="Error message">{detail.errorMessage ?? '—'}</Row>
            <Row label="Attempts">{detail.attempts}</Row>
            <Row label="Provider">{detail.provider ?? '—'}</Row>
            <Row label="Provider message ID">{detail.providerMessageId ?? '—'}</Row>
            <Row label="Created">{formatDateTime(detail.createdAt)}</Row>
            <Row label="Sent">{formatDateTime(detail.sentAt)}</Row>
            <Row label="Failed">{formatDateTime(detail.failedAt)}</Row>
            <Row label="Next attempt">{formatDateTime(detail.nextAttemptAt)}</Row>
            {detail.payload ? (
              <Row label="Payload">
                <pre className="overflow-x-auto rounded bg-[#f6f8f7] p-2 text-xs">
                  {JSON.stringify(detail.payload, null, 2)}
                </pre>
              </Row>
            ) : null}
          </dl>
        </Card>
      ) : null}
    </div>
  );
}
