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

const authState: { user: unknown; loading: boolean } = { user: null, loading: false };

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({
    login,
    user: authState.user,
    loading: authState.loading,
  }),
}));

function signedInUser(storeCount: number) {
  return {
    id: 'u1',
    email: 'merchant@example.com',
    memberships: {
      stores: Array.from({ length: storeCount }, (_, i) => ({ storeId: `s${i}` })),
    },
  };
}

async function fillAndSubmit(email: string, password: string) {
  const user = userEvent.setup();
  if (email) await user.type(screen.getByLabelText('Email'), email);
  if (password) await user.type(screen.getByLabelText('Password'), password);
  await user.click(screen.getByRole('button', { name: 'Sign In' }));
  return user;
}

describe('Login form', () => {
  beforeEach(() => {
    login.mockReset();
    replace.mockReset();
    authState.user = null;
    authState.loading = false;
  });

  afterEach(() => {
    cleanup();
  });

  it('sends a signed-in merchant without a store to onboarding', async () => {
    authState.user = signedInUser(0);
    render(<LoginPage />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/onboard'));
  });

  it('sends a signed-in merchant with a store to the dashboard', async () => {
    authState.user = signedInUser(1);
    render(<LoginPage />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/dashboard'));
  });

  it('shows a checking state instead of the form while the session is verified', () => {
    authState.loading = true;
    render(<LoginPage />);
    expect(screen.getByRole('status')).toHaveTextContent('Checking signed-in session');
    expect(screen.queryByLabelText('Email')).toBeNull();
    expect(replace).not.toHaveBeenCalled();
  });

  it('renders the redesigned form with accessible fields', () => {
    render(<LoginPage />);
    expect(screen.getByRole('heading', { level: 1, name: 'Welcome back' })).toBeInTheDocument();
    expect(screen.getByText('Sign in to manage your online store.')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveAttribute('autocomplete', 'email');
    expect(screen.getByLabelText('Password')).toHaveAttribute('autocomplete', 'current-password');
    expect(screen.getByRole('link', { name: 'Create your store' })).toHaveAttribute('href', '/register');
    expect(screen.getByText('Your account is protected with secure authentication.')).toBeInTheDocument();
    expect(screen.queryByText(/forgot/i)).toBeNull();
  });

  it('submits email and password to login', async () => {
    login.mockResolvedValue(undefined);
    render(<LoginPage />);

    await fillAndSubmit('merchant@example.com', 'SecurePass1');

    await waitFor(() => {
      expect(login).toHaveBeenCalledWith('merchant@example.com', 'SecurePass1');
    });
  });

  it('validates email and password next to the fields without calling the API', async () => {
    render(<LoginPage />);
    await fillAndSubmit('', '');

    const email = screen.getByLabelText('Email');
    expect(email).toHaveAttribute('aria-invalid', 'true');
    expect(email).toHaveAccessibleDescription('Enter your email address.');
    expect(email).toHaveFocus();
    expect(screen.getByLabelText('Password')).toHaveAccessibleDescription('Enter your password.');
    expect(login).not.toHaveBeenCalled();
  });

  it('rejects a malformed email address', async () => {
    render(<LoginPage />);
    await fillAndSubmit('not-an-email', 'SecurePass1');
    expect(screen.getByLabelText('Email')).toHaveAccessibleDescription('Enter a valid email address.');
    expect(login).not.toHaveBeenCalled();
  });

  it('shows a loading state and blocks duplicate submissions', async () => {
    let resolve!: () => void;
    login.mockImplementation(() => new Promise<void>((r) => (resolve = r)));
    render(<LoginPage />);

    const user = await fillAndSubmit('merchant@example.com', 'SecurePass1');
    const button = await screen.findByRole('button', { name: 'Signing in...' });
    expect(button).toBeDisabled();
    await user.click(button);
    expect(login).toHaveBeenCalledTimes(1);

    resolve();
    expect(await screen.findByRole('button', { name: 'Sign In' })).toBeEnabled();
  });

  it('shows a friendly message for invalid credentials', async () => {
    const { ApiError } = await import('@/lib/api-client');
    login.mockRejectedValue(new ApiError(401, 'UNAUTHORIZED', 'Invalid email or password.'));
    render(<LoginPage />);

    await fillAndSubmit('merchant@example.com', 'wrong');

    expect(await screen.findByRole('alert')).toHaveTextContent('Email or password is incorrect.');
  });

  it('passes through safe API messages such as rate limits', async () => {
    const { ApiError } = await import('@/lib/api-client');
    login.mockRejectedValue(
      new ApiError(403, 'FORBIDDEN', 'Too many requests. Please try again later.'),
    );
    render(<LoginPage />);
    await fillAndSubmit('merchant@example.com', 'SecurePass1');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Too many requests. Please try again later.',
    );
  });

  it('hides server faults and network failures behind a generic message', async () => {
    const { ApiError } = await import('@/lib/api-client');
    login.mockRejectedValueOnce(
      new ApiError(500, 'INTERNAL', 'PrismaClientKnownRequestError: connection refused'),
    );
    render(<LoginPage />);
    const user = await fillAndSubmit('merchant@example.com', 'SecurePass1');
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Unable to connect right now. Please try again.');
    expect(alert).not.toHaveTextContent(/prisma/i);

    login.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await user.click(screen.getByRole('button', { name: 'Sign In' }));
    await waitFor(() => expect(login).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to connect right now. Please try again.',
    );
  });

  it('toggles password visibility with an accessible button', async () => {
    const user = userEvent.setup();
    render(<LoginPage />);
    const password = screen.getByLabelText('Password');
    expect(password).toHaveAttribute('type', 'password');
    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(password).toHaveAttribute('type', 'text');
    await user.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(password).toHaveAttribute('type', 'password');
  });
});
