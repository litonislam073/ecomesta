import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SupportView from '@/app/dashboard/support/support-view';
import { ApiError } from '@/lib/api-client';

const get = vi.fn();
const post = vi.fn();

vi.mock('@/lib/api-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api-client')>('@/lib/api-client');
  return {
    ...actual,
    api: { get: (...args: unknown[]) => get(...args), post: (...args: unknown[]) => post(...args) },
  };
});

vi.mock('@/lib/store-context', () => ({
  useStoreContext: () => ({ selectedStore: { id: '6f1d2c1e-0000-4000-8000-000000000001', name: 'Demo Shop' } }),
}));

beforeEach(() => {
  get.mockReset();
  post.mockReset();
});

afterEach(() => cleanup());

describe('Support page', () => {
  it('shows the support email and sends a request with an idempotency id', async () => {
    get.mockResolvedValue({ success: true, data: { supportEmail: 'support@ecomesta.test', requestsEnabled: true } });
    post.mockResolvedValue({ success: true });
    const user = userEvent.setup();
    render(<SupportView />);

    expect(await screen.findByRole('link', { name: 'support@ecomesta.test' })).toHaveAttribute(
      'href',
      'mailto:support@ecomesta.test',
    );
    await user.selectOptions(screen.getByLabelText('Topic'), 'Billing');
    await user.type(screen.getByLabelText('Subject'), 'Invoice question');
    await user.type(screen.getByLabelText('Message'), 'Where can I download my invoice?');
    await user.click(screen.getByRole('button', { name: 'Send request' }));

    expect(await screen.findByText(/your message is on its way/)).toBeInTheDocument();
    const [path, body] = post.mock.calls[0] as [string, Record<string, string>];
    expect(path).toBe('/support/requests');
    expect(body).toMatchObject({
      category: 'Billing',
      subject: 'Invoice question',
      message: 'Where can I download my invoice?',
      storeId: '6f1d2c1e-0000-4000-8000-000000000001',
    });
    expect(body.requestId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('validates the subject and message', async () => {
    get.mockResolvedValue({ success: true, data: { supportEmail: 'support@ecomesta.test', requestsEnabled: true } });
    const user = userEvent.setup();
    render(<SupportView />);
    await user.click(await screen.findByRole('button', { name: 'Send request' }));
    expect(screen.getByText('Enter a subject of at least 3 characters.')).toBeInTheDocument();
    expect(screen.getByText('Describe your question in at least 10 characters.')).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it('explains when support requests are unavailable', async () => {
    get.mockResolvedValue({ success: true, data: { supportEmail: null, requestsEnabled: false } });
    render(<SupportView />);
    expect(await screen.findByText(/Support requests are not available right now/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Send request' })).toBeNull();
  });

  it('shows rate-limit errors from the API', async () => {
    get.mockResolvedValue({ success: true, data: { supportEmail: 'support@ecomesta.test', requestsEnabled: true } });
    post.mockRejectedValue(new ApiError(429, 'TOO_MANY_REQUESTS', 'Too many requests. Please try again later.'));
    const user = userEvent.setup();
    render(<SupportView />);
    await user.type(await screen.findByLabelText('Subject'), 'Help please');
    await user.type(screen.getByLabelText('Message'), 'Something is not working.');
    await user.click(screen.getByRole('button', { name: 'Send request' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Too many requests. Please try again later.');
  });
});
