import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoginPage from '@/app/login/login-form';

const login = vi.fn();
const replace = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({
    login,
    user: null,
    loading: false,
  }),
}));

describe('Login form', () => {
  beforeEach(() => {
    login.mockReset();
    replace.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it('submits email and password to login', async () => {
    const user = userEvent.setup();
    login.mockResolvedValue(undefined);
    render(<LoginPage />);

    await user.type(screen.getByLabelText('Email'), 'merchant@example.com');
    await user.type(screen.getByLabelText('Password'), 'SecurePass1');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(login).toHaveBeenCalledWith('merchant@example.com', 'SecurePass1');
    });
  });

  it('shows API error message', async () => {
    const user = userEvent.setup();
    const { ApiError } = await import('@/lib/api-client');
    login.mockRejectedValue(new ApiError(401, 'UNAUTHORIZED', 'Invalid credentials'));
    render(<LoginPage />);

    await user.type(screen.getByLabelText('Email'), 'merchant@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrong');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid credentials');
  });
});
