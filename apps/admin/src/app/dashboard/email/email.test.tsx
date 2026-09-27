import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import EmailStatusView from '@/app/dashboard/email/email-status-view';
import { ApiError } from '@/lib/api-client';

const get = vi.fn();

vi.mock('@/lib/api-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api-client')>('@/lib/api-client');
  return { ...actual, api: { get: (...args: unknown[]) => get(...args) } };
});

const overview = {
  config: {
    mode: 'smtp',
    deliversEmail: true,
    fromEmail: 'no-reply@ecomesta.test',
    fromName: 'Ecomesta',
    supportEmail: 'support@ecomesta.test',
    appPublicUrl: 'https://ecomesta.test',
    merchantUrl: 'https://merchant.ecomesta.test',
    smtp: { host: 'smtp.ecomesta.test', port: 587, secure: false, authConfigured: true },
  },
  last7Days: { PENDING: 1, SENDING: 0, SENT: 12, FAILED: 2, SKIPPED: 0 },
  recent: [
    {
      id: 'd1',
      eventType: 'STORE_CREATED',
      status: 'FAILED',
      provider: 'smtp',
      attempts: 2,
      errorCategory: 'timeout',
      createdAt: '2026-09-28T10:00:00.000Z',
      sentAt: null,
      nextAttemptAt: '2026-09-28T10:05:00.000Z',
    },
  ],
};

describe('Admin email status', () => {
  beforeEach(() => {
    get.mockReset();
  });

  it('shows configuration, counts and recent deliveries without credentials', async () => {
    get.mockResolvedValue({ success: true, data: overview });
    render(<EmailStatusView />);

    expect(await screen.findByText('Delivering email')).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith('/admin/email');
    expect(screen.getByText('Ecomesta <no-reply@ecomesta.test>')).toBeInTheDocument();
    expect(screen.getByText('smtp.ecomesta.test:587')).toBeInTheDocument();
    expect(screen.getByText('Configured')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('STORE_CREATED')).toBeInTheDocument();
    expect(screen.getByText(/Error: timeout/)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/password/i);
  });

  it('flags a configuration that does not deliver email', async () => {
    get.mockResolvedValue({
      success: true,
      data: { ...overview, config: { ...overview.config, mode: 'disabled', deliversEmail: false, smtp: null }, recent: [] },
    });
    render(<EmailStatusView />);
    expect(await screen.findByText('Not delivering email')).toBeInTheDocument();
    expect(screen.getByText('Disabled (nothing is sent)')).toBeInTheDocument();
    expect(screen.getByText('No emails yet')).toBeInTheDocument();
  });

  it('shows an error state when the request fails', async () => {
    get.mockRejectedValue(new ApiError(403, 'FORBIDDEN', 'Insufficient platform role'));
    render(<EmailStatusView />);
    expect(await screen.findByRole('alert')).toHaveTextContent('This action requires the Super Admin platform role.');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});
