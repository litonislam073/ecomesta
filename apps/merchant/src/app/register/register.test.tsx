import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RegisterPage from '@/app/register/register-form';

const register = vi.fn();
const replace = vi.fn();

const searchParams = { value: new URLSearchParams() };
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => searchParams.value,
}));

vi.mock('@/lib/api-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api-client')>('@/lib/api-client');
  return {
    ...actual,
    api: {
      get: () =>
        Promise.resolve({
          success: true,
          data: [{ slug: 'growth', name: 'Growth', prices: [], trialMonths: 2 }],
        }),
    },
  };
});

const authState: { user: unknown; loading: boolean } = { user: null, loading: false };

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({
    register,
    user: authState.user,
    loading: authState.loading,
  }),
}));

async function fillValid(user: ReturnType<typeof userEvent.setup>, email = 'merchant@example.com') {
  await user.type(screen.getByLabelText('First name'), 'Liton');
  await user.type(screen.getByLabelText('Last name'), 'Islam');
  await user.type(screen.getByLabelText('Email'), email);
  await user.type(screen.getByLabelText('Password'), 'SecurePass1');
}

describe('Register form', () => {
  beforeEach(() => {
    register.mockReset();
    replace.mockReset();
    authState.user = null;
    authState.loading = false;
    searchParams.value = new URLSearchParams();
  });

  afterEach(() => {
    cleanup();
  });

  it('submits registration fields and redirects to onboard', async () => {
    const user = userEvent.setup();
    register.mockResolvedValue(undefined);
    render(<RegisterPage />);

    await fillValid(user);
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(register).toHaveBeenCalledWith({
        email: 'merchant@example.com',
        password: 'SecurePass1',
        firstName: 'Liton',
        lastName: 'Islam',
        phone: undefined,
      });
    });
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/onboard');
    });
    expect(screen.getByRole('status')).toHaveTextContent('Taking you to store setup');
  });

  it('keeps the pricing-page plan and interval through registration', async () => {
    const user = userEvent.setup();
    searchParams.value = new URLSearchParams('plan=growth&interval=yearly');
    register.mockResolvedValue(undefined);
    render(<RegisterPage />);

    expect(await screen.findByText(/Growth plan · Yearly/)).toBeInTheDocument();
    expect(screen.getByText(/you pay for it in the last step of store setup/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /sign in/i })).toHaveAttribute(
      'href',
      `/login?next=${encodeURIComponent('/onboard?plan=growth&interval=yearly')}`,
    );

    await fillValid(user);
    await user.click(screen.getByRole('button', { name: /create account/i }));
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/onboard?plan=growth&interval=yearly');
    });
  });

  it('ignores off-site next redirects', async () => {
    const user = userEvent.setup();
    searchParams.value = new URLSearchParams('next=//evil.example');
    register.mockResolvedValue(undefined);
    render(<RegisterPage />);
    await fillValid(user);
    await user.click(screen.getByRole('button', { name: /create account/i }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/onboard'));
  });

  it('shows API error message', async () => {
    const user = userEvent.setup();
    const { ApiError } = await import('@/lib/api-client');
    register.mockRejectedValue(
      new ApiError(409, 'CONFLICT', 'Email already registered'),
    );
    render(<RegisterPage />);

    await fillValid(user, 'taken@example.com');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Email already registered',
    );
    expect(replace).not.toHaveBeenCalled();
  });

  it('lists API validation details', async () => {
    const user = userEvent.setup();
    const { ApiError } = await import('@/lib/api-client');
    register.mockRejectedValue(
      new ApiError(400, 'VALIDATION_ERROR', 'Validation failed', ['phone must be shorter than or equal to 32 characters']),
    );
    render(<RegisterPage />);
    await fillValid(user);
    await user.click(screen.getByRole('button', { name: 'Create Account' }));
    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText('phone must be shorter than or equal to 32 characters')).toBeInTheDocument();
  });

  it('links to login', () => {
    render(<RegisterPage />);
    expect(screen.getByRole('link', { name: /sign in/i })).toHaveAttribute(
      'href',
      '/login',
    );
  });

  it('renders the redesigned form as the first onboarding step', () => {
    render(<RegisterPage />);
    expect(screen.getByRole('heading', { level: 1, name: 'Create your store' })).toBeInTheDocument();
    expect(screen.getByText('Start building your online business with Ecomesta.')).toBeInTheDocument();
    expect(screen.getByText(/Step 1 of 2/)).toBeInTheDocument();
    expect(screen.getByLabelText('First name')).toHaveAttribute('autocomplete', 'given-name');
    expect(screen.getByLabelText('Last name')).toHaveAttribute('autocomplete', 'family-name');
    expect(screen.getByLabelText('Email')).toHaveAttribute('autocomplete', 'email');
    expect(screen.getByLabelText('Phone (optional)')).toHaveAttribute('autocomplete', 'tel');
    expect(screen.getByLabelText('Password')).toHaveAttribute('autocomplete', 'new-password');
  });

  it('validates required fields next to each input without calling the API', async () => {
    const user = userEvent.setup();
    render(<RegisterPage />);
    await user.click(screen.getByRole('button', { name: 'Create Account' }));

    const first = screen.getByLabelText('First name');
    expect(first).toHaveAttribute('aria-invalid', 'true');
    expect(first).toHaveAccessibleDescription('Enter your first name.');
    expect(first).toHaveFocus();
    expect(screen.getByLabelText('Last name')).toHaveAccessibleDescription('Enter your last name.');
    expect(screen.getByLabelText('Email')).toHaveAccessibleDescription('Enter your email address.');
    expect(screen.getByLabelText('Password')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Phone (optional)')).not.toHaveAttribute('aria-invalid');
    expect(register).not.toHaveBeenCalled();
  });

  it('shows the backend password requirements and tracks them live', async () => {
    const user = userEvent.setup();
    render(<RegisterPage />);
    const rules = screen.getByRole('list', { name: 'Password requirements' });
    expect(within(rules).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      '8 to 128 characters (not met)',
      'At least one letter (not met)',
      'At least one number (not met)',
    ]);

    await user.type(screen.getByLabelText('Password'), 'password');
    expect(within(rules).getByText('8 to 128 characters').parentElement).toHaveTextContent('(met)');
    expect(within(rules).getByText('At least one number').parentElement).toHaveTextContent('(not met)');

    await user.type(screen.getByLabelText('First name'), 'Liton');
    await user.type(screen.getByLabelText('Last name'), 'Islam');
    await user.type(screen.getByLabelText('Email'), 'merchant@example.com');
    await user.click(screen.getByRole('button', { name: 'Create Account' }));
    expect(screen.getByLabelText('Password')).toHaveAttribute('aria-invalid', 'true');
    expect(register).not.toHaveBeenCalled();
  });

  it('shows a loading state and never sends a duplicate registration', async () => {
    const user = userEvent.setup();
    register.mockImplementation(() => new Promise<void>(() => {}));
    render(<RegisterPage />);
    await fillValid(user);
    await user.click(screen.getByRole('button', { name: 'Create Account' }));

    const button = await screen.findByRole('button', { name: 'Creating account...' });
    expect(button).toBeDisabled();
    await user.click(button);
    expect(register).toHaveBeenCalledTimes(1);
  });

  it('shows a checking state while an existing session is verified', () => {
    authState.loading = true;
    render(<RegisterPage />);
    expect(screen.getByRole('status')).toHaveTextContent('Checking signed-in session');
    expect(screen.queryByLabelText('Email')).toBeNull();
  });

  it('keeps redirecting signed-in merchants as before', async () => {
    authState.user = { id: 'u1', memberships: { stores: [{ storeId: 's1' }] } };
    render(<RegisterPage />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/dashboard'));
  });
});
