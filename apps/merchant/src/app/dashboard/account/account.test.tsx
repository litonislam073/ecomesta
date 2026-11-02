import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AccountPage from '@/app/dashboard/account/page';
import ConfirmEmailChangeView from '@/app/confirm-email-change/confirm-email-change-view';
import { ApiError } from '@/lib/api-client';

const pushToast = vi.fn();
const reloadProfile = vi.fn();
const auth = {
  user: {
    id: 'u1',
    email: 'rahim@gmial.com',
    firstName: 'Rahim',
    lastName: 'Uddin',
    emailVerified: false,
    pendingEmail: null as string | null,
    platformRole: 'USER',
    status: 'ACTIVE',
    memberships: { tenants: [], stores: [] },
  } as Record<string, unknown> | null,
  reloadProfile,
};

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));
vi.mock('@/components/ui/toast', () => ({ useToast: () => ({ pushToast }) }));
vi.mock('@/lib/auth-context', () => ({ useAuth: () => auth }));

const api = { post: vi.fn() };
vi.mock('@/lib/api-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api-client')>('@/lib/api-client');
  return { ...actual, api: { post: (...args: unknown[]) => api.post(...args) } };
});

beforeEach(() => {
  api.post.mockReset();
  reloadProfile.mockReset().mockResolvedValue(undefined);
  pushToast.mockReset();
  auth.user = { ...auth.user!, pendingEmail: null };
});

describe('My account → change email', () => {
  it('shows the sign-in email and whether it is confirmed', () => {
    render(<AccountPage />);
    expect(screen.getByText('rahim@gmial.com')).toBeInTheDocument();
    expect(screen.getByText('Not confirmed')).toBeInTheDocument();
    expect(screen.getByText('Rahim Uddin')).toBeInTheDocument();
  });

  it('checks the form before asking the API', async () => {
    const user = userEvent.setup();
    render(<AccountPage />);
    await user.type(screen.getByLabelText('New email address'), 'rahim@gmial.com');
    await user.click(screen.getByRole('button', { name: 'Send confirmation link' }));
    expect(screen.getByRole('alert')).toHaveTextContent('This is already your email address.');
    await user.clear(screen.getByLabelText('New email address'));
    await user.type(screen.getByLabelText('New email address'), 'rahim@gmail.com');
    await user.click(screen.getByRole('button', { name: 'Send confirmation link' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Enter your current password.');
    expect(api.post).not.toHaveBeenCalled();
  });

  it('sends the new address with the current password and shows API errors', async () => {
    const user = userEvent.setup();
    api.post.mockRejectedValueOnce(new ApiError(400, 'CURRENT_PASSWORD_INCORRECT', 'Your current password is not correct.'));
    render(<AccountPage />);
    await user.type(screen.getByLabelText('New email address'), ' Rahim@Gmail.com');
    await user.type(screen.getByLabelText('Current password'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Send confirmation link' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Your current password is not correct.');

    api.post.mockResolvedValueOnce({ success: true, data: { pendingEmail: 'rahim@gmail.com', expiresInHours: 24 } });
    await user.clear(screen.getByLabelText('Current password'));
    await user.type(screen.getByLabelText('Current password'), 'SecurePass1');
    await user.click(screen.getByRole('button', { name: 'Send confirmation link' }));
    await waitFor(() =>
      expect(api.post).toHaveBeenLastCalledWith('/auth/email-change', {
        email: 'rahim@gmail.com',
        currentPassword: 'SecurePass1',
      }),
    );
    expect(reloadProfile).toHaveBeenCalled();
  });

  it('shows a pending change and can cancel it', async () => {
    const user = userEvent.setup();
    auth.user = { ...auth.user!, pendingEmail: 'rahim@gmail.com' };
    api.post.mockResolvedValue({ success: true, data: { cancelled: true } });
    render(<AccountPage />);
    expect(screen.getByRole('status')).toHaveTextContent('We sent a link to rahim@gmail.com');
    await user.click(screen.getByRole('button', { name: 'Cancel change' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/auth/email-change/cancel'));
    expect(pushToast).toHaveBeenCalledWith('Email change cancelled.', 'success');
  });
});

describe('Confirm new email link', () => {
  it('confirms the token from the link and shows the new address', async () => {
    window.history.replaceState(null, '', `/confirm-email-change#token=${'a'.repeat(43)}`);
    api.post.mockResolvedValue({ success: true, data: { email: 'rahim@gmail.com' } });
    render(<ConfirmEmailChangeView />);
    expect(await screen.findByText('Email address changed')).toBeInTheDocument();
    expect(screen.getByText('rahim@gmail.com')).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledWith('/auth/email-change/confirm', { token: 'a'.repeat(43) }, { token: null });
    // The token never stays in the address bar.
    expect(window.location.hash).toBe('');
    await waitFor(() => expect(reloadProfile).toHaveBeenCalled());
  });

  it('explains an expired link', async () => {
    window.history.replaceState(null, '', `/confirm-email-change#token=${'b'.repeat(43)}`);
    api.post.mockRejectedValue(new ApiError(400, 'EMAIL_CHANGE_TOKEN_EXPIRED', 'expired'));
    render(<ConfirmEmailChangeView />);
    expect(await screen.findByText('This link has expired')).toBeInTheDocument();
  });
});
