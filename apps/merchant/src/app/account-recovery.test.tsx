import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ForgotPasswordForm, { FORGOT_PASSWORD_SENT } from '@/app/forgot-password/forgot-password-form';
import ResetPasswordForm from '@/app/reset-password/reset-password-form';
import VerifyEmailView from '@/app/verify-email/verify-email-view';
import { ApiError } from '@/lib/api-client';

const post = vi.fn();

vi.mock('@/lib/api-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api-client')>('@/lib/api-client');
  return { ...actual, api: { post: (...args: unknown[]) => post(...args) } };
});

const TOKEN = 'a'.repeat(43);

function openWithHash(path: string, hash: string) {
  window.history.replaceState(null, '', `${path}${hash}`);
}

beforeEach(() => {
  post.mockReset();
});

afterEach(() => {
  cleanup();
  window.history.replaceState(null, '', '/');
});

describe('Forgot password form', () => {
  it('shows the same generic confirmation after submitting', async () => {
    post.mockResolvedValue({ success: true });
    const user = userEvent.setup();
    render(<ForgotPasswordForm />);

    await user.type(screen.getByLabelText('Email'), 'Merchant@Example.com ');
    await user.click(screen.getByRole('button', { name: 'Send Reset Link' }));

    expect(await screen.findByText(FORGOT_PASSWORD_SENT)).toBeInTheDocument();
    expect(post).toHaveBeenCalledWith('/auth/forgot-password', { email: 'Merchant@Example.com' }, { token: null });
    expect(screen.getByRole('link', { name: 'Back to sign in' })).toHaveAttribute('href', '/login');
  });

  it('validates the email without calling the API', async () => {
    const user = userEvent.setup();
    render(<ForgotPasswordForm />);
    await user.click(screen.getByRole('button', { name: 'Send Reset Link' }));
    expect(screen.getByLabelText('Email')).toHaveAccessibleDescription('Enter your email address.');
    await user.type(screen.getByLabelText('Email'), 'not-an-email');
    await user.click(screen.getByRole('button', { name: 'Send Reset Link' }));
    expect(screen.getByLabelText('Email')).toHaveAccessibleDescription('Enter a valid email address.');
    expect(post).not.toHaveBeenCalled();
  });

  it('shows rate-limit messages and hides server faults', async () => {
    post.mockRejectedValueOnce(new ApiError(429, 'TOO_MANY_REQUESTS', 'Too many requests. Please try again later.'));
    const user = userEvent.setup();
    render(<ForgotPasswordForm />);
    await user.type(screen.getByLabelText('Email'), 'merchant@example.com');
    await user.click(screen.getByRole('button', { name: 'Send Reset Link' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Too many requests. Please try again later.');

    post.mockRejectedValueOnce(new ApiError(500, 'INTERNAL', 'SMTP connection refused'));
    await user.click(screen.getByRole('button', { name: 'Send Reset Link' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Unable to connect right now.'));
    expect(screen.getByRole('alert')).not.toHaveTextContent(/smtp/i);
  });
});

describe('Reset password form', () => {
  it('reads the token from the fragment, removes it from the URL and resets the password', async () => {
    openWithHash('/reset-password', `#token=${TOKEN}`);
    post.mockResolvedValue({ success: true });
    const user = userEvent.setup();
    render(<ResetPasswordForm />);

    const password = await screen.findByLabelText('New password');
    expect(window.location.hash).toBe('');
    expect(post).toHaveBeenCalledWith('/auth/reset-password/validate', { token: TOKEN }, { token: null });

    await user.type(password, 'NewSecure123');
    await user.type(screen.getByLabelText('Confirm new password'), 'NewSecure123');
    await user.click(screen.getByRole('button', { name: 'Reset Password' }));

    expect(await screen.findByText('Password updated')).toBeInTheDocument();
    expect(screen.getByText(/signed out on all devices/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign In' })).toHaveAttribute('href', '/login');
    expect(post).toHaveBeenLastCalledWith(
      '/auth/reset-password',
      { token: TOKEN, password: 'NewSecure123' },
      { token: null },
    );
  });

  it('rejects weak and mismatched passwords before calling the API', async () => {
    openWithHash('/reset-password', `#token=${TOKEN}`);
    post.mockResolvedValue({ success: true });
    const user = userEvent.setup();
    render(<ResetPasswordForm />);

    await user.type(await screen.findByLabelText('New password'), 'short');
    await user.type(screen.getByLabelText('Confirm new password'), 'different');
    await user.click(screen.getByRole('button', { name: 'Reset Password' }));

    expect(screen.getByText('Password does not meet the requirements below.')).toBeInTheDocument();
    expect(screen.getByText('Passwords do not match.')).toBeInTheDocument();
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('shows a clear message when there is no token', async () => {
    openWithHash('/reset-password', '');
    render(<ResetPasswordForm />);
    expect(await screen.findByText('This reset link is not valid')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Request a New Link' })).toHaveAttribute('href', '/forgot-password');
    expect(post).not.toHaveBeenCalled();
  });

  it.each([
    ['RESET_TOKEN_EXPIRED', 'This reset link has expired'],
    ['RESET_TOKEN_USED', 'This reset link was already used'],
    ['RESET_TOKEN_INVALID', 'This reset link is not valid'],
  ])('explains a %s link', async (code, title) => {
    openWithHash('/reset-password', `#token=${TOKEN}`);
    post.mockRejectedValue(new ApiError(400, code, 'Server message'));
    render(<ResetPasswordForm />);
    expect(await screen.findByText(title)).toBeInTheDocument();
  });

  it('shows a generic message when the server fails', async () => {
    openWithHash('/reset-password', `#token=${TOKEN}`);
    post.mockRejectedValue(new ApiError(500, 'INTERNAL', 'database down'));
    render(<ResetPasswordForm />);
    expect(await screen.findByText('We could not check your link')).toBeInTheDocument();
    expect(screen.queryByText(/database/)).toBeNull();
  });

  it('switches to the used-link message if the token is consumed before submit', async () => {
    openWithHash('/reset-password', `#token=${TOKEN}`);
    post
      .mockResolvedValueOnce({ success: true })
      .mockRejectedValueOnce(new ApiError(400, 'RESET_TOKEN_USED', 'used'));
    const user = userEvent.setup();
    render(<ResetPasswordForm />);
    await user.type(await screen.findByLabelText('New password'), 'NewSecure123');
    await user.type(screen.getByLabelText('Confirm new password'), 'NewSecure123');
    await user.click(screen.getByRole('button', { name: 'Reset Password' }));
    expect(await screen.findByText('This reset link was already used')).toBeInTheDocument();
  });
});

describe('Verify email view', () => {
  it('confirms the token from the fragment', async () => {
    openWithHash('/verify-email', `#token=${TOKEN}`);
    post.mockResolvedValue({ success: true });
    render(<VerifyEmailView />);
    expect(await screen.findByText('Email address confirmed')).toBeInTheDocument();
    expect(window.location.hash).toBe('');
    expect(post).toHaveBeenCalledWith('/auth/email-verification/confirm', { token: TOKEN }, { token: null });
  });

  it('explains an expired link', async () => {
    openWithHash('/verify-email', `#token=${TOKEN}`);
    post.mockRejectedValue(new ApiError(400, 'VERIFICATION_TOKEN_EXPIRED', 'expired'));
    render(<VerifyEmailView />);
    expect(await screen.findByText('This confirmation link has expired')).toBeInTheDocument();
  });
});
