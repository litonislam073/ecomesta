'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import type { AdminSupportConversationSummary, OffsetPageMeta } from '@ecomesta/types';
import { Button } from '@ecomesta/ui';
import { PageHeader } from '@/components/admin/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Input } from '@/components/ui/input';
import { LoadingState } from '@/components/ui/loading-state';
import { Pagination } from '@/components/ui/pagination';
import { buildQuery, formatDateTime, humanApiError } from '@/lib/admin-utils';
import { api } from '@/lib/api-client';

export default function AdminSupportChatsPage() {
  const [items, setItems] = useState<AdminSupportConversationSummary[]>([]);
  const [meta, setMeta] = useState<OffsetPageMeta | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.get<{
        success: true;
        data: { items: AdminSupportConversationSummary[]; meta: OffsetPageMeta };
      }>(`/admin/support-chats?${buildQuery({ page, limit: 20, search: query || undefined })}`);
      setItems(result.data.items);
      setMeta(result.data.meta);
    } catch (err) {
      setError(humanApiError(err, 'Failed to load support chats'));
    } finally {
      setLoading(false);
    }
  }, [page, query]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Support chats"
        description="Conversations visitors had with the support assistant on the Ecomesta website, newest first."
      />

      <form
        className="flex flex-wrap gap-2"
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          setPage(1);
          setQuery(search.trim());
        }}
      >
        <Input
          className="max-w-sm"
          placeholder="Name, phone, email or reference"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search support chats"
        />
        <Button type="submit" variant="secondary">
          Search
        </Button>
        {query ? (
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setSearch('');
              setQuery('');
              setPage(1);
            }}
          >
            Clear
          </Button>
        ) : null}
      </form>

      {meta && !loading && !error ? (
        <p className="text-sm text-[var(--color-muted)]" aria-live="polite">
          {meta.total} {meta.total === 1 ? 'chat' : 'chats'}
          {query ? ` matching “${query}”` : ''}
        </p>
      ) : null}

      {loading ? <LoadingState label="Loading support chats" /> : null}
      {!loading && error ? <ErrorState message={error} onRetry={() => void load()} /> : null}
      {!loading && !error && items.length === 0 ? (
        <EmptyState
          title={query ? 'No chats found' : 'No support chats yet'}
          description={
            query
              ? 'Try a different name, phone number or email.'
              : 'Chats appear here once a visitor starts one from the website.'
          }
        />
      ) : null}
      {!loading && !error && items.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[var(--color-border)] bg-[#f3f7f5] text-[var(--color-muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">Visitor</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">First question</th>
                <th className="px-4 py-3 font-medium">Messages</th>
                <th className="px-4 py-3 font-medium">Last message</th>
              </tr>
            </thead>
            <tbody>
              {items.map((chat) => (
                <tr key={chat.id} className="border-b border-[var(--color-border)] last:border-b-0">
                  <td className="px-4 py-3">
                    <Link
                      className="font-medium text-[var(--color-accent)] hover:underline"
                      href={`/dashboard/support-chats/${chat.id}`}
                    >
                      {chat.visitorName}
                    </Link>
                    {chat.handoffReference ? (
                      <span className="ml-2 rounded-full bg-[#fff6e0] px-2 py-0.5 text-xs font-semibold text-[#8a5a00]">
                        Asked for a person
                      </span>
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <a className="hover:underline" href={`tel:${chat.visitorPhone}`}>
                      {chat.visitorPhone}
                    </a>
                  </td>
                  <td className="px-4 py-3">{chat.visitorEmail ?? <span className="text-[var(--color-muted)]">—</span>}</td>
                  <td className="max-w-xs truncate px-4 py-3 text-[var(--color-muted)]" title={chat.firstMessage ?? undefined}>
                    {chat.firstMessage ?? 'No messages yet'}
                  </td>
                  <td className="px-4 py-3">{chat.messageCount}</td>
                  <td className="whitespace-nowrap px-4 py-3">{formatDateTime(chat.lastMessageAt ?? chat.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {meta && meta.totalPages > 1 ? (
        <Pagination page={meta.page} totalPages={meta.totalPages} onPageChange={setPage} />
      ) : null}
    </div>
  );
}
