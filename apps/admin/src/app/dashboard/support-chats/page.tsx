'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import type {
  AdminSupportConversationSource,
  AdminSupportConversationSummary,
  OffsetPageMeta,
} from '@ecomesta/types';
import { Button } from '@ecomesta/ui';
import { PageHeader } from '@/components/admin/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Input } from '@/components/ui/input';
import { LoadingState } from '@/components/ui/loading-state';
import { Pagination } from '@/components/ui/pagination';
import { Select } from '@/components/ui/select';
import { buildQuery, formatDateTime, humanApiError } from '@/lib/admin-utils';
import { api } from '@/lib/api-client';

type SourceFilter = '' | AdminSupportConversationSource;

export default function AdminSupportChatsPage() {
  const [items, setItems] = useState<AdminSupportConversationSummary[]>([]);
  const [meta, setMeta] = useState<OffsetPageMeta | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [source, setSource] = useState<SourceFilter>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const latest = useRef(0);

  const load = useCallback(async () => {
    const id = ++latest.current;
    setLoading(true);
    setError(null);
    try {
      const result = await api.get<{
        success: true;
        data: { items: AdminSupportConversationSummary[]; meta: OffsetPageMeta };
      }>(
        `/admin/support-chats?${buildQuery({
          page,
          limit: 20,
          search: query || undefined,
          source: source || undefined,
        })}`,
      );
      if (id !== latest.current) return;
      setItems(result.data.items);
      setMeta(result.data.meta);
    } catch (err) {
      if (id === latest.current) setError(humanApiError(err, 'Failed to load support chats'));
    } finally {
      if (id === latest.current) setLoading(false);
    }
  }, [page, query, source]);

  useEffect(() => {
    void load();
    return () => {
      latest.current += 1;
    };
  }, [load]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Support chats"
        description="Conversations from the website support assistant and contact form, newest first."
      />

      <form
        className="flex flex-wrap items-end gap-2"
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
        <label className="block space-y-1.5" htmlFor="support-source">
          <span className="sr-only">Source</span>
          <Select
            id="support-source"
            value={source}
            onChange={(e) => {
              setPage(1);
              setSource(e.target.value as SourceFilter);
            }}
            aria-label="Filter by source"
          >
            <option value="">All sources</option>
            <option value="CHAT">Chat</option>
            <option value="CONTACT_FORM">Contact form</option>
          </Select>
        </label>
        <Button type="submit" variant="secondary">
          Search
        </Button>
        {query || source ? (
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setSearch('');
              setQuery('');
              setSource('');
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
          {source === 'CONTACT_FORM' ? ' from the contact form' : ''}
          {source === 'CHAT' ? ' from chat' : ''}
        </p>
      ) : null}

      {loading ? <LoadingState label="Loading support chats" /> : null}
      {!loading && error ? <ErrorState message={error} onRetry={() => void load()} /> : null}
      {!loading && !error && items.length === 0 ? (
        <EmptyState
          title={query || source ? 'No chats found' : 'No support chats yet'}
          description={
            query || source
              ? 'Try a different name, phone number, email or source filter.'
              : 'Chats appear here once a visitor starts one from the website or sends the contact form.'
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
                    {chat.source === 'CONTACT_FORM' ? (
                      <span className="ml-2 rounded-full bg-[#e8f1ff] px-2 py-0.5 text-xs font-semibold text-[#1a4a8a]">
                        Contact form
                      </span>
                    ) : null}
                    {chat.handoffReference && chat.source !== 'CONTACT_FORM' ? (
                      <span className="ml-2 rounded-full bg-[#fff6e0] px-2 py-0.5 text-xs font-semibold text-[#8a5a00]">
                        Asked for a person
                      </span>
                    ) : null}
                    {chat.handoffReference && chat.source === 'CONTACT_FORM' ? (
                      <span className="ml-2 font-mono text-xs text-[var(--color-muted)]">
                        #{chat.handoffReference}
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
