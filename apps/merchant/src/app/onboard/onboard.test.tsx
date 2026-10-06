import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OnboardForm from '@/app/onboard/onboard-form';
import OnboardRoute, { metadata } from '@/app/onboard/page';

const post = vi.fn();
const get = vi.fn();
const reloadProfile = vi.fn();
const refreshStores = vi.fn();
const logout = vi.fn();
const replace = vi.fn();

const searchParams = { value: new URLSearchParams() };
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => searchParams.value,
}));

vi.mock('@/lib/api-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api-client')>(
    '@/lib/api-client',
  );
  return {
    ...actual,
    api: {
      post: (...args: unknown[]) => post(...args),
      get: (...args: unknown[]) => get(...args),
    },
  };
});

function merchant(storeCount = 0) {
  return {
    id: 'u1',
    email: 'new@example.com',
    firstName: 'New',
    lastName: 'Merchant',
    platformRole: 'USER',
    status: 'ACTIVE',
    memberships: {
      tenants: [],
      stores: Array.from({ length: storeCount }, (_, i) => ({ storeId: `s${i}` })),
    },
  };
}

const authState: { user: unknown; loading: boolean; accessToken: string | null } = {
  user: merchant(),
  loading: false,
  accessToken: 'access-token',
};

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({ ...authState, reloadProfile, logout }),
}));

vi.mock('@/lib/store-context', () => ({
  useStoreContext: () => ({
    refreshStores,
  }),
}));

const PLANS = ['starter', 'growth', 'business'].map((slug, i) => ({
  slug,
  name: slug[0]!.toUpperCase() + slug.slice(1),
  description: null,
  tagline: null,
  features: [],
  highlighted: slug === 'growth',
  currency: 'BDT',
  monthlyPrice: [99, 299, 699][i]!,
  trialMonths: 0,
  prices: [
    { billingCycle: 'MONTHLY', amount: [99, 299, 699][i]!, months: 1, discountPercent: 0, effectiveMonthly: [99, 299, 699][i]! },
    { billingCycle: 'YEARLY', amount: [891, 2691, 6291][i]!, months: 12, discountPercent: 25, effectiveMonthly: 0 },
  ],
}));
const ACCOUNTS = [
  { method: 'BKASH', label: 'bKash', number: '01309093407', transferType: 'Send Money' },
  { method: 'NAGAD', label: 'Nagad', number: '01309093407', transferType: 'Send Money' },
];

/** Public plans and the wallet numbers come from the API; everything else answers empty. */
function mockApi() {
  get.mockImplementation(async (path: string) => {
    if (path === '/public/plans') return { success: true, data: PLANS };
    if (path === '/billing/payment-accounts') return { success: true, data: ACCOUNTS };
    return { success: true, data: [] };
  });
}

const continueButton = () => screen.getByRole('button', { name: 'Continue to payment' });
const payButton = () => screen.getByRole('button', { name: /create my store/ });

/** Store details → payment step → the payment that creates the store. */
async function payAndCreate(user: ReturnType<typeof userEvent.setup>, { double = false } = {}) {
  await screen.findByRole('radio', { name: /Starter/ });
  await user.click(continueButton());
  await user.type(await screen.findByLabelText('Your bKash number'), '01712345678');
  await user.type(screen.getByLabelText('Transaction ID'), 'trx12345');
  if (double) await user.dblClick(payButton());
  else await user.click(payButton());
}

/** Existing behaviour tests skip the success-path display floor and redirect pause. */
function renderForm(props: { minDisplayMs?: number; redirectDelayMs?: number } = {}) {
  return render(<OnboardForm minDisplayMs={0} redirectDelayMs={0} {...props} />);
}

function deferred<T = unknown>() {
  let resolve: (value: T) => void = () => undefined;
  let reject: (reason: unknown) => void = () => undefined;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const setupSteps = () =>
  within(screen.getByRole('list', { name: 'Store setup progress' }))
    .getAllByRole('listitem')
    .map((item) => item.textContent);

describe('Onboard form', () => {
  beforeEach(() => {
    post.mockReset();
    get.mockReset();
    mockApi();
    searchParams.value = new URLSearchParams();
    reloadProfile.mockReset();
    refreshStores.mockReset();
    logout.mockReset();
    replace.mockReset();
    reloadProfile.mockResolvedValue(undefined);
    refreshStores.mockResolvedValue(undefined);
    logout.mockResolvedValue(undefined);
    authState.user = merchant();
    authState.loading = false;
    authState.accessToken = 'access-token';
    vi.stubEnv('NEXT_PUBLIC_WEB_URL', 'http://localhost:3000');
    vi.stubEnv('NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN', '');
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  it('posts to /onboarding/store then refreshes stores and opens the dashboard', async () => {
    const user = userEvent.setup();
    post.mockResolvedValue({ success: true, data: {} });
    renderForm();

    await user.type(await screen.findByLabelText('Business name'), 'Demo Shop BD');
    await screen.findByRole('radio', { name: /Starter/ });
    await payAndCreate(user);

    await waitFor(() => {
      expect(post).toHaveBeenCalledWith(
        '/onboarding/store',
        {
          businessName: 'Demo Shop BD',
          storeName: 'Demo Shop BD',
          tenantSlug: 'demo-shop-bd',
          storeSlug: 'demo-shop-bd',
          currency: 'BDT',
          timezone: 'Asia/Dhaka',
          locale: 'en-BD',
          planSlug: 'starter',
          billingCycle: 'MONTHLY',
          method: 'BKASH',
          senderNumber: '01712345678',
          transactionId: 'TRX12345',
        },
        { token: 'access-token' },
      );
    });
    await waitFor(() => {
      expect(reloadProfile).toHaveBeenCalled();
      expect(refreshStores).toHaveBeenCalled();
      expect(replace).toHaveBeenCalledWith('/dashboard');
    });
    expect(screen.getByRole('status')).toHaveTextContent('Store created. Waiting for payment confirmation.');
  });

  it('keeps the plan and interval chosen on the pricing page and asks for payment at the end', async () => {
    const user = userEvent.setup();
    searchParams.value = new URLSearchParams('plan=growth&interval=yearly');
    post.mockResolvedValue({ success: true, data: {} });
    renderForm();

    expect(await screen.findByRole('radio', { name: /Growth/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: /Yearly/ })).toBeChecked();
    expect(screen.getByText('৳2,691 / year')).toBeInTheDocument();
    expect(screen.getByText(/You pay for it in the next step/)).toBeInTheDocument();
    expect(screen.queryByText(/months free|free trial/i)).toBeNull();

    await user.type(screen.getByLabelText('Business name'), 'Demo Shop BD');
    await user.click(continueButton());
    // Payment is the last step: the amount comes from the chosen plan and period.
    expect(await screen.findByRole('heading', { level: 1, name: 'Pay for your plan' })).toBeInTheDocument();
    const progress = screen.getByRole('list', { name: 'Setup progress' });
    expect(within(progress).getAllByRole('listitem')[2]).toHaveAttribute('aria-current', 'step');
    expect(screen.getByText('Growth plan')).toBeInTheDocument();
    expect(screen.getAllByText('৳2,691').length).toBeGreaterThan(0);
    expect(post).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText('Your bKash number'), '01712345678');
    await user.type(screen.getByLabelText('Transaction ID'), 'TRX12345');
    await user.click(payButton());
    await waitFor(() => {
      expect(post).toHaveBeenCalledWith(
        '/onboarding/store',
        expect.objectContaining({ planSlug: 'growth', billingCycle: 'YEARLY', method: 'BKASH', transactionId: 'TRX12345' }),
        { token: 'access-token' },
      );
    });
  });

  it('keeps a refused payment on the payment step with what was typed', async () => {
    const user = userEvent.setup();
    const { ApiError } = await import('@/lib/api-client');
    post.mockRejectedValueOnce(
      new ApiError(409, 'CONFLICT', 'This transaction ID has already been submitted. Check the ID in your payment message.'),
    );
    renderForm();
    await user.type(await screen.findByLabelText('Business name'), 'Demo Shop');
    await screen.findByRole('radio', { name: /Starter/ });
    await payAndCreate(user);

    expect(await screen.findByRole('alert')).toHaveTextContent('This transaction ID has already been submitted');
    expect(screen.getByLabelText('Transaction ID')).toHaveValue('TRX12345');
    expect(screen.getByLabelText('Your bKash number')).toHaveValue('01712345678');
    expect(reloadProfile).not.toHaveBeenCalled();

    // Fixing the ID and paying again creates the store.
    post.mockResolvedValueOnce({ success: true, data: {} });
    await user.clear(screen.getByLabelText('Transaction ID'));
    await user.type(screen.getByLabelText('Transaction ID'), 'TRX99999');
    await user.click(payButton());
    await waitFor(() => expect(post).toHaveBeenLastCalledWith(
      '/onboarding/store',
      expect.objectContaining({ transactionId: 'TRX99999' }),
      { token: 'access-token' },
    ));
  });

  it('goes back to the store details without losing them', async () => {
    const user = userEvent.setup();
    renderForm();
    await user.type(await screen.findByLabelText('Business name'), 'Demo Shop');
    await screen.findByRole('radio', { name: /Starter/ });
    await user.click(continueButton());
    await user.click(await screen.findByRole('button', { name: '← Back to store details' }));
    expect(screen.getByLabelText('Business name')).toHaveValue('Demo Shop');
    expect(post).not.toHaveBeenCalled();
  });

  it('sends signed-out visitors to register without losing the chosen plan', async () => {
    searchParams.value = new URLSearchParams('plan=business&interval=6-months');
    authState.user = null;
    renderForm();
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/register?plan=business&interval=6-months');
    });
  });

  it('blocks empty Latin slug for non-ASCII business names', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText('Business name'), 'বাংলা দোকান');
    await user.click(continueButton());

    expect(post).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Store URL')).toHaveAccessibleDescription(/latin letters or numbers/i);
  });

  it('shows a checking state instead of the form while the session loads', () => {
    authState.loading = true;
    authState.user = null;
    renderForm();
    expect(screen.getByRole('status')).toHaveTextContent('Checking your account...');
    expect(screen.queryByLabelText('Business name')).toBeNull();
    expect(replace).not.toHaveBeenCalled();
  });

  it('keeps sending signed-out visitors to registration', async () => {
    authState.user = null;
    renderForm();
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/register?next=/onboard'));
    expect(screen.queryByLabelText('Business name')).toBeNull();
  });

  it('never offers a second store to a merchant who already has one', async () => {
    authState.user = merchant(1);
    renderForm();
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/dashboard'));
    expect(screen.queryByRole('button', { name: 'Continue to payment' })).toBeNull();
    expect(post).not.toHaveBeenCalled();
  });

  it('renders the setup step with accessible progress and fields', () => {
    renderForm();
    expect(screen.getByRole('heading', { level: 1, name: "Let's set up your store" })).toBeInTheDocument();
    expect(
      screen.getByText('Add a few details about your business to get your Ecomesta store ready.'),
    ).toBeInTheDocument();
    const progress = screen.getByRole('list', { name: 'Setup progress' });
    const steps = within(progress).getAllByRole('listitem');
    expect(steps[0]).toHaveTextContent('Account (completed)');
    expect(steps[1]).toHaveAttribute('aria-current', 'step');
    expect(within(progress).queryByRole('link')).toBeNull();

    expect(screen.getByLabelText('Business name')).toHaveAttribute('autocomplete', 'organization');
    expect(screen.getByLabelText('Store name')).toHaveAccessibleDescription(
      /name customers will see on your storefront/,
    );
    expect(screen.getByLabelText('Store name')).toHaveAttribute('autocomplete', 'off');
    expect(screen.getByLabelText('Store URL')).toBeRequired();
    expect(screen.queryByLabelText(/description/i)).toBeNull();
    expect(screen.queryByLabelText(/email/i)).toBeNull();
  });

  it('validates business and store names next to the fields and focuses the first error', async () => {
    const user = userEvent.setup();
    renderForm();
    await user.type(screen.getByLabelText('Store name'), 'A');
    await user.click(continueButton());

    const business = screen.getByLabelText('Business name');
    expect(business).toHaveAttribute('aria-invalid', 'true');
    expect(business).toHaveAccessibleDescription(/Enter a business name between 2 and 120 characters\./);
    await waitFor(() => expect(business).toHaveFocus());
    expect(screen.getByLabelText('Store name')).toHaveAttribute('aria-invalid', 'true');
    expect(post).not.toHaveBeenCalled();
  });

  it('lets merchants type a hyphenated store URL and previews the address', async () => {
    const user = userEvent.setup();
    post.mockResolvedValue({ success: true, data: {} });
    renderForm();
    await user.type(screen.getByLabelText('Business name'), 'Demo Shop');
    const slug = screen.getByLabelText('Store URL');
    expect(slug).toHaveValue('demo-shop');
    await user.clear(slug);
    await user.type(slug, 'My Cool-Store!');
    expect(slug).toHaveValue('my-cool-store-');
    await user.tab();
    expect(slug).toHaveValue('my-cool-store');
    expect(slug).toHaveAccessibleDescription(/http:\/\/localhost:3000\/\?store=my-cool-store/);

    await payAndCreate(user);
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        '/onboarding/store',
        expect.objectContaining({ storeSlug: 'my-cool-store', tenantSlug: 'my-cool-store' }),
        { token: 'access-token' },
      ),
    );
  });

  it('rejects a store URL the API would reject', async () => {
    const user = userEvent.setup();
    renderForm();
    await user.type(screen.getByLabelText('Business name'), 'Demo Shop');
    await user.clear(screen.getByLabelText('Store URL'));
    await user.type(screen.getByLabelText('Store URL'), 'a');
    await user.click(continueButton());
    expect(screen.getByLabelText('Store URL')).toHaveAttribute('aria-invalid', 'true');
    expect(post).not.toHaveBeenCalled();
  });

  it('accepts a 63-character store URL, the longest the API allows', async () => {
    const user = userEvent.setup();
    post.mockResolvedValue({ success: true, data: {} });
    renderForm();
    await user.type(screen.getByLabelText('Business name'), 'Demo Shop');
    const slug = screen.getByLabelText('Store URL');
    const longest = `${'a'.repeat(31)}-${'b'.repeat(31)}`;
    expect(longest).toHaveLength(63);
    await user.clear(slug);
    await user.click(slug);
    await user.paste(longest);
    await payAndCreate(user);

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        '/onboarding/store',
        expect.objectContaining({ storeSlug: longest, tenantSlug: longest }),
        { token: 'access-token' },
      ),
    );
    expect(slug).not.toHaveAttribute('aria-invalid');
  });

  it('rejects a 64-character store URL without truncating it', async () => {
    const user = userEvent.setup();
    renderForm();
    await user.type(screen.getByLabelText('Business name'), 'Demo Shop');
    const slug = screen.getByLabelText('Store URL');
    const tooLong = 'a'.repeat(64);
    await user.clear(slug);
    await user.click(slug);
    await user.paste(tooLong);
    await user.tab();
    expect(slug).toHaveValue(tooLong);

    await user.click(continueButton());
    expect(slug).toHaveAttribute('aria-invalid', 'true');
    expect(slug).toHaveAccessibleDescription(/Store URL must be 63 characters or fewer\./);
    await waitFor(() => expect(slug).toHaveFocus());
    expect(post).not.toHaveBeenCalled();
  });

  it('keeps the suggested store URL within 63 characters for long business names', async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByLabelText('Business name'));
    await user.paste(`${'Long '.repeat(15)}Shop`);
    const value = (screen.getByLabelText('Store URL') as HTMLInputElement).value;
    expect(value.length).toBeLessThanOrEqual(63);
    expect(value).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  });

  it('sends an edited account ID separately from the store URL', async () => {
    const user = userEvent.setup();
    post.mockResolvedValue({ success: true, data: {} });
    renderForm();
    await user.type(screen.getByLabelText('Business name'), 'Demo Shop');
    await user.click(screen.getByText('Advanced settings'));
    const tenant = screen.getByLabelText('Account ID');
    expect(tenant).toHaveValue('demo-shop');
    await user.clear(tenant);
    await user.type(tenant, 'demo-holdings');
    await payAndCreate(user);
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        '/onboarding/store',
        expect.objectContaining({ storeSlug: 'demo-shop', tenantSlug: 'demo-holdings' }),
        { token: 'access-token' },
      ),
    );
  });

  it('shows the setup summary with platform defaults', async () => {
    const user = userEvent.setup();
    renderForm();
    const summary = screen.getByRole('region', { name: 'Summary' });
    expect(within(summary).getAllByText('Not set yet')).toHaveLength(2);
    await user.type(screen.getByLabelText('Business name'), 'Demo Shop');
    await user.type(screen.getByLabelText('Store name'), 'Demo Store');
    expect(within(summary).getByText('Demo Store')).toBeInTheDocument();
    expect(within(summary).getByText('http://localhost:3000/?store=demo-shop')).toBeInTheDocument();
    expect(within(summary).getByText('Bangladesh')).toBeInTheDocument();
    expect(within(summary).getByText('BDT')).toBeInTheDocument();
    expect(within(summary).getByText('Asia/Dhaka')).toBeInTheDocument();
    expect(summary).not.toHaveTextContent(/tenant|s0|u1/i);
  });

  it('shows a loading state and never sends duplicate store requests', async () => {
    const user = userEvent.setup();
    post.mockImplementation(() => new Promise(() => {}));
    renderForm();
    await user.type(screen.getByLabelText('Business name'), 'Demo Shop');
    await payAndCreate(user);
    const busy = await screen.findByRole('button', { name: 'Creating Store...' });
    expect(busy).toBeDisabled();
    await user.click(busy);
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('maps a slug conflict to the store URL field', async () => {
    const user = userEvent.setup();
    const { ApiError } = await import('@/lib/api-client');
    post.mockRejectedValue(new ApiError(409, 'CONFLICT', 'Tenant slug is already taken'));
    renderForm();
    await user.type(screen.getByLabelText('Business name'), 'Demo Shop');
    await payAndCreate(user);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'That store URL is already in use. Try another one.',
    );
    expect(screen.getByLabelText('Store URL')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.queryByText(/tenant slug/i)).toBeNull();
    expect(continueButton()).toBeEnabled();
  });

  it('maps a conflict on an edited account ID to that field', async () => {
    const user = userEvent.setup();
    const { ApiError } = await import('@/lib/api-client');
    post.mockRejectedValue(new ApiError(409, 'CONFLICT', 'Tenant slug is already taken'));
    renderForm();
    await user.type(screen.getByLabelText('Business name'), 'Demo Shop');
    await user.click(screen.getByText('Advanced settings'));
    await user.clear(screen.getByLabelText('Account ID'));
    await user.type(screen.getByLabelText('Account ID'), 'taken-id');
    await payAndCreate(user);
    await screen.findByRole('alert');
    expect(screen.getByLabelText('Account ID')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Store URL')).not.toHaveAttribute('aria-invalid');
  });

  it('highlights fields from API validation without showing raw messages', async () => {
    const user = userEvent.setup();
    const { ApiError } = await import('@/lib/api-client');
    post.mockRejectedValue(
      new ApiError(400, 'BAD_REQUEST', 'Validation failed', [
        'storeSlug must match /^[a-z0-9]+(?:-[a-z0-9]+)*$/ regular expression',
      ]),
    );
    renderForm();
    await user.type(screen.getByLabelText('Business name'), 'Demo Shop');
    await payAndCreate(user);
    expect(await screen.findByRole('alert')).toHaveTextContent('Please check the highlighted fields.');
    expect(screen.getByLabelText('Store URL')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.queryByText(/regular expression/)).toBeNull();
  });

  it('hides server faults and network failures behind a generic message', async () => {
    const user = userEvent.setup();
    const { ApiError } = await import('@/lib/api-client');
    post.mockRejectedValueOnce(
      new ApiError(500, 'INTERNAL_SERVER_ERROR', 'PrismaClientKnownRequestError: P2002'),
    );
    renderForm();
    await user.type(screen.getByLabelText('Business name'), 'Demo Shop');
    await payAndCreate(user);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Unable to create your store right now. Please try again.');
    expect(alert).not.toHaveTextContent(/prisma|P2002/i);

    post.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await payAndCreate(user);
    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to create your store right now. Please try again.',
    );
  });

  describe('store provisioning', () => {
    it('replaces the form with the provisioning screen while the store is created', async () => {
      const user = userEvent.setup();
      post.mockReturnValue(deferred().promise);
      renderForm();
      await user.type(screen.getByLabelText('Business name'), 'Fresh Fashion');
      await payAndCreate(user);

      const heading = await screen.findByRole('heading', { level: 1, name: 'Creating your store' });
      await waitFor(() => expect(heading).toHaveFocus());
      expect(screen.getByText("We're getting everything ready for your online business.")).toBeInTheDocument();
      expect(screen.getByText('Setting up Fresh Fashion')).toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveTextContent('Creating your store...');
      expect(setupSteps()).toEqual([
        'Account verified (completed)',
        expect.stringContaining('Payment submitted (completed)'),
        expect.stringContaining('Creating your store (in progress)'),
        expect.stringContaining('Preparing your dashboard (pending)'),
      ]);
      expect(screen.getByRole('button', { name: 'Creating Store...' })).toBeDisabled();
      expect(screen.queryByLabelText('Business name')).toBeNull();
    });

    it('sends one request for a double-clicked Create Store button', async () => {
      const user = userEvent.setup();
      post.mockReturnValue(deferred().promise);
      renderForm();
      await user.type(screen.getByLabelText('Business name'), 'Fresh Fashion');
      await payAndCreate(user, { double: true });
      await screen.findByRole('heading', { name: 'Creating your store' });
      expect(post).toHaveBeenCalledTimes(1);
    });

    it('marks the store step done only after the API responds, then finishes', async () => {
      const user = userEvent.setup();
      const create = deferred();
      const profile = deferred<void>();
      post.mockReturnValue(create.promise);
      reloadProfile.mockReturnValue(profile.promise);
      renderForm({ redirectDelayMs: 60_000 });
      await user.type(screen.getByLabelText('Business name'), 'Fresh Fashion');
      await payAndCreate(user);
      await screen.findByRole('heading', { name: 'Creating your store' });
      expect(setupSteps()[2]).toContain('(in progress)');

      create.resolve({ success: true, data: {} });
      await waitFor(() =>
        expect(screen.getByRole('status')).toHaveTextContent('Store created. Preparing your dashboard...'),
      );
      expect(setupSteps()[2]).toContain('(completed)');
      expect(setupSteps()[3]).toContain('(in progress)');

      // The new membership arrives mid-flow; it must not swap in the "already has a store" screen.
      authState.user = merchant(1);
      profile.resolve();

      const done = await screen.findByRole('heading', { level: 1, name: 'Your store has been created' });
      await waitFor(() => expect(done).toHaveFocus());
      expect(screen.getByText(/goes live for customers as soon as it is confirmed/)).toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveTextContent('Store created. Waiting for payment confirmation.');
      expect(setupSteps().every((step) => step?.includes('(completed)'))).toBe(true);
      expect(refreshStores).toHaveBeenCalledTimes(1);
      expect(replace).not.toHaveBeenCalled();

      await user.click(screen.getByRole('button', { name: 'Go to Dashboard' }));
      expect(replace).toHaveBeenCalledWith('/dashboard');
    });

    it('redirects to the dashboard automatically after success', async () => {
      const user = userEvent.setup();
      post.mockResolvedValue({ success: true, data: {} });
      renderForm({ redirectDelayMs: 50 });
      await user.type(screen.getByLabelText('Business name'), 'Fresh Fashion');
      await payAndCreate(user);
      await screen.findByRole('heading', { name: 'Your store has been created' });
      await waitFor(() => expect(replace).toHaveBeenCalledWith('/dashboard'));
    });

    it('holds a very fast success on screen briefly instead of flashing past', async () => {
      const user = userEvent.setup();
      post.mockResolvedValue({ success: true, data: {} });
      renderForm({ minDisplayMs: 400, redirectDelayMs: 60_000 });
      await user.type(screen.getByLabelText('Business name'), 'Fresh Fashion');
      await payAndCreate(user);
      await waitFor(() =>
        expect(screen.getByRole('status')).toHaveTextContent('Store created. Preparing your dashboard...'),
      );
      expect(screen.queryByRole('heading', { name: 'Your store has been created' })).toBeNull();
      expect(
        await screen.findByRole('heading', { name: 'Your store has been created' }, { timeout: 2000 }),
      ).toBeInTheDocument();
    });

    it('stops at once on failure and returns to the form with a safe message', async () => {
      const user = userEvent.setup();
      const { ApiError } = await import('@/lib/api-client');
      post.mockRejectedValue(new ApiError(500, 'INTERNAL_SERVER_ERROR', 'relation "stores" does not exist'));
      renderForm({ minDisplayMs: 60_000 });
      await user.type(screen.getByLabelText('Business name'), 'Fresh Fashion');
      await payAndCreate(user);

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent("We couldn't create your store");
      expect(alert).toHaveTextContent('Unable to create your store right now. Please try again.');
      expect(alert).not.toHaveTextContent(/relation|stores/);
      expect(screen.getByLabelText('Business name')).toHaveValue('Fresh Fashion');
      expect(continueButton()).toBeEnabled();
      expect(reloadProfile).not.toHaveBeenCalled();
      await waitFor(() => expect(alert.parentElement).toHaveFocus());
    });

    it('returns a duplicate store URL to the form and focuses that field', async () => {
      const user = userEvent.setup();
      const { ApiError } = await import('@/lib/api-client');
      post.mockRejectedValue(new ApiError(409, 'CONFLICT', 'Store slug is already taken'));
      renderForm();
      await user.type(screen.getByLabelText('Business name'), 'Fresh Fashion');
      await payAndCreate(user);

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent("We couldn't create your store");
      expect(alert).toHaveTextContent('That store URL is already in use. Try another one.');
      const slug = screen.getByLabelText('Store URL');
      expect(slug).toHaveAttribute('aria-invalid', 'true');
      await waitFor(() => expect(slug).toHaveFocus());
    });

    it('never shows tenant or store IDs from the API response', async () => {
      const user = userEvent.setup();
      post.mockResolvedValue({
        success: true,
        data: {
          tenant: { id: '5f1f7e0c-tenant-id', slug: 'fresh-fashion' },
          store: { id: '9a2b4c6d-store-id', tenantId: '5f1f7e0c-tenant-id', slug: 'fresh-fashion' },
        },
      });
      const { container } = renderForm({ redirectDelayMs: 60_000 });
      await user.type(screen.getByLabelText('Business name'), 'Fresh Fashion');
      await payAndCreate(user);
      await screen.findByRole('heading', { name: 'Your store has been created' });
      expect(container.textContent).not.toMatch(/tenant-id|store-id|5f1f7e0c|9a2b4c6d/);
      expect(screen.getByText('Fresh Fashion')).toBeInTheDocument();
    });
  });

  it('signs out to the login page, not registration', async () => {
    const user = userEvent.setup();
    renderForm();
    expect(screen.getByText('new@example.com')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(logout).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
    expect(replace).not.toHaveBeenCalledWith('/register?next=/onboard');
  });
});

describe('Onboard route', () => {
  const SITE = 'https://staging.ecomesta.example';

  beforeEach(() => {
    get.mockResolvedValue({ success: true, data: [] });
    authState.user = merchant();
    authState.loading = false;
    authState.accessToken = 'access-token';
    vi.stubEnv('NEXT_PUBLIC_WEB_URL', SITE);
    vi.stubEnv('NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN', 'staging.ecomesta.example');
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  it('uses the light branded shell without marketing navigation', () => {
    render(<OnboardRoute />);
    const header = screen.getByRole('banner');
    expect(within(header).getByRole('link', { name: 'Ecomesta' })).toHaveAttribute('href', `${SITE}/`);
    expect(within(header).getByRole('link', { name: 'Need help?' })).toHaveAttribute('href', `${SITE}/contact`);
    expect(screen.queryByRole('navigation', { name: 'Primary' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Create Your Store' })).toBeNull();
    const footer = screen.getByRole('contentinfo');
    expect(within(footer).getByRole('link', { name: 'FAQ' })).toHaveAttribute('href', `${SITE}/faq`);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('main')).toContainElement(screen.getByRole('heading', { level: 1 }));
  });

  it('previews the real subdomain address and never links to localhost', async () => {
    const user = userEvent.setup();
    const { container } = render(<OnboardRoute />);
    await user.type(screen.getByLabelText('Business name'), 'Demo Shop');
    expect(screen.getByLabelText('Store URL')).toHaveAccessibleDescription(
      /https:\/\/demo-shop\.staging\.ecomesta\.example/,
    );
    expect(container.innerHTML).not.toMatch(/localhost/);
  });

  it('omits the address preview when a deployed build has no platform domain', async () => {
    vi.stubEnv('NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN', '');
    const user = userEvent.setup();
    const { container } = render(<OnboardRoute />);
    await user.type(screen.getByLabelText('Business name'), 'Demo Shop');
    expect(screen.getByLabelText('Store URL')).not.toHaveAccessibleDescription(/https?:\/\//);
    expect(within(screen.getByRole('region', { name: 'Summary' })).getByText('demo-shop')).toBeInTheDocument();
    expect(container.innerHTML).not.toMatch(/\?store=/);
  });

  it('is excluded from search indexes without a canonical', () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
    expect(metadata.alternates).toBeUndefined();
  });
});
