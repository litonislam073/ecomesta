'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { AdminSupportConversation } from '@ecomesta/types';
import { PageHeader } from '@/components/admin/page-header';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { formatDateTime, humanApiError } from '@/lib/admin-utils';
import { api } from '@/lib/api-client';

export default function AdminSupportChatDetailPage() {
  const params = useParams<{ conversationId: string }>();
  const conversationId = params.conversationId;
  const [chat, setChat] = useState<AdminSupportConversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!conversationId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.get<{ success: true; data: AdminSupportConversation }>(
        `/admin/support-chats/${conversationId}`,
      );
      setChat(result.data);
    } catch (err) {
      setError(humanApiError(err, 'Failed to load the chat'));
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <Link href="/dashboard/support-chats" className="text-sm text-[var(--color-accent)] hover:underline">
        ← All support chats
      </Link>

      {loading ? <LoadingState label="Loading chat" /> : null}
      {!loading && error ? <ErrorState message={error} onRetry={() => void load()} /> : null}

      {!loading && !error && chat ? (
        <>
          <PageHeader title={chat.visitorName} description={`Chat started ${formatDateTime(chat.createdAt)}`} />

          <Card>
            <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <dt className="text-[var(--color-muted)]">Phone</dt>
                <dd className="font-semibold">
                  <a className="hover:underline" href={`tel:${chat.visitorPhone}`}>
                    {chat.visitorPhone}
                  </a>
                </dd>
              </div>
              <div>
                <dt className="text-[var(--color-muted)]">Email</dt>
                <dd className="font-semibold">
                  {chat.visitorEmail ? (
                    <a className="hover:underline" href={`mailto:${chat.visitorEmail}`}>
                      {chat.visitorEmail}
                    </a>
                  ) : (
                    'Not given'
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--color-muted)]">Messages</dt>
                <dd className="font-semibold">{chat.messageCount}</dd>
              </div>
              <div>
                <dt className="text-[var(--color-muted)]">Asked for a person</dt>
                <dd className="font-semibold">{chat.handoffReference ? `Yes · #${chat.handoffReference}` : 'No'}</dd>
              </div>
              {chat.userAgent ? (
                <div className="sm:col-span-2 lg:col-span-4">
                  <dt className="text-[var(--color-muted)]">Browser</dt>
                  <dd className="break-words text-xs text-[var(--color-muted)]">{chat.userAgent}</dd>
                </div>
              ) : null}
            </dl>
          </Card>

          {chat.messages.length === 0 ? (
            <EmptyState title="No messages" description="The visitor gave their details but did not send a message." />
          ) : (
            <ol aria-label="Conversation" className="space-y-3 rounded-xl border border-[var(--color-border)] bg-[#f6f8f7] p-4">
              {chat.messages.map((message) => {
                const visitor = message.role === 'USER';
                return (
                  <li key={message.id} className={`flex ${visitor ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                        visitor ? 'rounded-tr-md bg-[#145240] text-white' : 'rounded-tl-md bg-white text-[var(--color-ink)]'
                      }`}
                    >
                      <p className={`mb-1 text-xs font-semibold ${visitor ? 'text-white/75' : 'text-[var(--color-muted)]'}`}>
                        {visitor ? chat.visitorName : 'Support assistant'} · {formatDateTime(message.createdAt)}
                      </p>
                      <p className="whitespace-pre-wrap break-words">{message.content}</p>
                      {message.handoffReason ? (
                        <p className="mt-2 rounded-lg bg-[#fff6e0] px-2 py-1 text-xs text-[#8a5a00]">
                          Offered a person: {message.handoffReason}
                        </p>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </>
      ) : null}
    </div>
  );
}
