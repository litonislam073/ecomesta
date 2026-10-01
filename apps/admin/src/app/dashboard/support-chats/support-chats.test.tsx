import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AdminSupportConversation, AdminSupportConversationSummary } from '@ecomesta/types';
import AdminSupportChatDetailPage from '@/app/dashboard/support-chats/[conversationId]/page';
import AdminSupportChatsPage from '@/app/dashboard/support-chats/page';
import { ApiError } from '@/lib/api-client';

vi.mock('next/link', () => ({
  default: ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

vi.mock('next/navigation', () => ({
  useParams: () => ({ conversationId: 'chat-1' }),
}));

const api = { get: vi.fn() };

vi.mock('@/lib/api-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api-client')>('@/lib/api-client');
  return { ...actual, api: { get: (...args: unknown[]) => api.get(...args) } };
});

const summary: AdminSupportConversationSummary = {
  id: 'chat-1',
  visitorName: 'Rahim Uddin',
  visitorPhone: '01711000000',
  visitorEmail: null,
  messageCount: 4,
  firstMessage: 'Can I use my own domain?',
  handoffReference: 'AB12CD34',
  lastMessageAt: '2026-10-01T06:05:00.000Z',
  createdAt: '2026-10-01T06:00:00.000Z',
};

function listResponse(items: AdminSupportConversationSummary[]) {
  return { success: true, data: { items, meta: { total: items.length, page: 1, limit: 20, totalPages: 1 } } };
}

describe('Admin support chats list', () => {
  // Braces matter: a function returned from beforeEach is run by Vitest as a
  // cleanup hook, so returning the mock would call it once more after each test.
  beforeEach(() => {
    api.get.mockReset();
  });

  it('lists chats with the visitor’s details and links to each conversation', async () => {
    api.get.mockResolvedValue(listResponse([summary, { ...summary, id: 'chat-2', visitorName: 'Salma', visitorEmail: 'salma@example.com', handoffReference: null }]));
    render(<AdminSupportChatsPage />);

    const row = (await screen.findByRole('link', { name: 'Rahim Uddin' })).closest('tr')!;
    expect(screen.getByRole('link', { name: 'Rahim Uddin' })).toHaveAttribute('href', '/dashboard/support-chats/chat-1');
    expect(within(row).getByRole('link', { name: '01711000000' })).toHaveAttribute('href', 'tel:01711000000');
    expect(within(row).getByText('Can I use my own domain?')).toBeInTheDocument();
    expect(within(row).getByText('Asked for a person')).toBeInTheDocument();
    expect(within(screen.getByRole('link', { name: 'Salma' }).closest('tr')!).getByText('salma@example.com')).toBeInTheDocument();
    expect(screen.getByText('2 chats')).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith('/admin/support-chats?page=1&limit=20');
  });

  it('searches by name, phone or email', async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue(listResponse([summary]));
    render(<AdminSupportChatsPage />);
    await screen.findByRole('link', { name: 'Rahim Uddin' });

    api.get.mockResolvedValue(listResponse([]));
    await user.type(screen.getByLabelText('Search support chats'), '01999');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(api.get).toHaveBeenLastCalledWith('/admin/support-chats?page=1&limit=20&search=01999'));
    expect(await screen.findByText('No chats found')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear' }));
    await waitFor(() => expect(api.get).toHaveBeenLastCalledWith('/admin/support-chats?page=1&limit=20'));
  });

  it('shows an empty state and a retryable error', async () => {
    const user = userEvent.setup();
    api.get.mockRejectedValueOnce(new ApiError(500, 'INTERNAL_SERVER_ERROR', 'boom'));
    render(<AdminSupportChatsPage />);
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument();
    api.get.mockResolvedValue(listResponse([]));
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('No support chats yet')).toBeInTheDocument();
  });
});

describe('Admin support chat detail', () => {
  beforeEach(() => {
    api.get.mockReset();
  });

  it('shows the visitor’s details and the whole conversation in order', async () => {
    const chat: AdminSupportConversation = {
      ...summary,
      userAgent: 'Mozilla/5.0 (iPhone)',
      messages: [
        { id: 'm1', role: 'USER', content: 'Can I use my own domain?', handoffReason: null, createdAt: '2026-10-01T06:00:01.000Z' },
        { id: 'm2', role: 'ASSISTANT', content: 'Yes, on the Growth plan.', handoffReason: null, createdAt: '2026-10-01T06:00:02.000Z' },
        { id: 'm3', role: 'USER', content: 'I want a refund', handoffReason: null, createdAt: '2026-10-01T06:05:00.000Z' },
        { id: 'm4', role: 'ASSISTANT', content: 'A person can help.', handoffReason: 'Refund question', createdAt: '2026-10-01T06:05:01.000Z' },
      ],
    };
    api.get.mockResolvedValue({ success: true, data: chat });
    render(<AdminSupportChatDetailPage />);

    expect(await screen.findByRole('heading', { name: 'Rahim Uddin' })).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith('/admin/support-chats/chat-1');
    expect(screen.getByRole('link', { name: '01711000000' })).toHaveAttribute('href', 'tel:01711000000');
    expect(screen.getByText('Not given')).toBeInTheDocument();
    expect(screen.getByText('Yes · #AB12CD34')).toBeInTheDocument();

    const items = within(screen.getByRole('list', { name: 'Conversation' })).getAllByRole('listitem');
    expect(items.map((item) => item.querySelector('p:nth-of-type(2)')?.textContent)).toEqual([
      'Can I use my own domain?',
      'Yes, on the Growth plan.',
      'I want a refund',
      'A person can help.',
    ]);
    expect(items[0]).toHaveTextContent('Rahim Uddin');
    expect(items[1]).toHaveTextContent('Support assistant');
    expect(items[3]).toHaveTextContent('Offered a person: Refund question');
  });

  it('shows an error when the chat cannot be loaded', async () => {
    // Every request fails: the page must show the error once and not keep asking.
    api.get.mockRejectedValue(new ApiError(404, 'NOT_FOUND', 'Conversation not found'));
    render(<AdminSupportChatDetailPage />);
    expect(within(await screen.findByRole('alert')).getByText('Conversation not found')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledTimes(1);
  });
});
