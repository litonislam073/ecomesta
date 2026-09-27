import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoginForm from '@/app/login/login-form';
import { ApiError } from '@/lib/api-client';

const login = vi.fn();
const logout = vi.fn();
const replace = vi.fn();

let authState = {
  user: null as { email: string; platformRole: string } | null,
  loading: false,
  isSuperAdmin: false,
};

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({ ...authState, login, logout }),
}));

describe('Admin login', () => {
  beforeEach(() => {
    login.mockReset();
    logout.mockReset();
    replace.mockReset();
    authState = { user: null, loading: false, isSuperAdmin: false };
  });

  it('submits email and password to login', async () => {
    const user = userEvent.setup();
    login.mockResolvedValue(undefined);
    render(<LoginForm />);

    await user.type(screen.getByLabelText('Email'), 'admin@ecomesta.local');
    await user.type(screen.getByLabelText('Password'), 'SecurePass1');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(login).toHaveBeenCalledWith('admin@ecomesta.local', 'SecurePass1');
    });
  });

  it('shows the API error message on bad credentials', async () => {
    const user = userEvent.setup();
    login.mockRejectedValue(new ApiError(401, 'UNAUTHORIZED', 'Invalid credentials'));
    render(<LoginForm />);

    await user.type(screen.getByLabelText('Email'), 'admin@ecomesta.local');
    await user.type(screen.getByLabelText('Password'), 'wrong');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid credentials');
  });

  it('blocks a signed-in account without the SUPER_ADMIN role', () => {
    authState = {
      user: { email: 'merchant@example.com', platformRole: 'USER' },
      loading: false,
      isSuperAdmin: false,
    };
    render(<LoginForm />);

    expect(screen.getByRole('heading', { name: /access denied/i })).toBeInTheDocument();
    expect(screen.getByText(/merchant@example.com/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it('redirects a Super Admin straight to the dashboard', () => {
    authState = {
      user: { email: 'admin@ecomesta.local', platformRole: 'SUPER_ADMIN' },
      loading: false,
      isSuperAdmin: true,
    };
    render(<LoginForm />);

    expect(replace).toHaveBeenCalledWith('/dashboard');
  });
});
