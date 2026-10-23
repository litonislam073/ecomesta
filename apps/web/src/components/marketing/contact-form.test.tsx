import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ContactForm } from './contact-form';

const postMock = vi.fn();
vi.mock('@/lib/public-api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/public-api')>('@/lib/public-api');
  return { ...actual, publicPost: (...args: unknown[]) => postMock(...args) };
});

const { PublicApiError } = await vi.importActual<typeof import('@/lib/public-api')>('@/lib/public-api');

async function fill(user: ReturnType<typeof userEvent.setup>, message = 'I want to open a clothing store.') {
  await user.type(screen.getByLabelText('Your name'), 'Rahim Uddin');
  await user.type(screen.getByLabelText('Phone number'), '01711-000000');
  await user.type(screen.getByLabelText(/Email/), 'rahim@example.com');
  await user.type(screen.getByLabelText('How can we help?'), message);
}

describe('Contact form', () => {
  beforeEach(() => postMock.mockReset());

  it('requires name, phone, email and a message, and points to the first problem', async () => {
    const user = userEvent.setup();
    render(<ContactForm />);
    expect(screen.getByLabelText('Your name')).toBeRequired();
    expect(screen.getByLabelText('Phone number')).toBeRequired();
    expect(screen.getByLabelText('How can we help?')).toBeRequired();
    expect(screen.getByLabelText(/Email/)).toBeRequired();
    expect(screen.queryByText(/optional/i)).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Send message' }));
    expect(screen.getByLabelText('Your name')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Phone number')).toHaveAccessibleDescription('Please enter your phone number.');
    expect(screen.getByLabelText(/Email/)).toHaveAccessibleDescription('Please enter your email address.');
    expect(screen.getByLabelText('How can we help?')).toHaveAccessibleDescription(/Please write your message/);
    expect(screen.getByLabelText('Your name')).toHaveFocus();

    await user.type(screen.getByLabelText('Your name'), 'Rahim');
    await user.type(screen.getByLabelText('Phone number'), '01711000000');
    await user.clear(screen.getByLabelText(/Email/));
    await user.type(screen.getByLabelText(/Email/), 'not-an-email');
    await user.type(screen.getByLabelText('How can we help?'), 'Too short');
    await user.click(screen.getByRole('button', { name: 'Send message' }));
    expect(screen.getByLabelText(/Email/)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('How can we help?')).toHaveAccessibleDescription(/at least 10 characters/);
    expect(postMock).not.toHaveBeenCalled();
  });

  it('sends the request to the Ecomesta team and shows the reference', async () => {
    const user = userEvent.setup();
    postMock.mockResolvedValue({ success: true, data: { submitted: true, reference: 'AB12CD34' } });
    render(<ContactForm />);
    await fill(user);
    await user.selectOptions(screen.getByLabelText('Topic'), 'Payments and billing');
    await user.click(screen.getByRole('button', { name: 'Send message' }));

    await waitFor(() =>
      expect(postMock).toHaveBeenCalledWith('/ai-support/handoff', {
        name: 'Rahim Uddin',
        phone: '01711000000',
        email: 'rahim@example.com',
        message: 'I want to open a clothing store.',
        reason: 'Payments and billing',
        transcript: [],
      }),
    );
    const done = await screen.findByRole('heading', { name: /Thank you, Rahim Uddin/ });
    await waitFor(() => expect(done).toHaveFocus());
    expect(screen.getByRole('status')).toHaveTextContent('01711-000000');
    expect(screen.getByRole('status')).toHaveTextContent('rahim@example.com');
    expect(await screen.findByText('AB12CD34')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Send another message' }));
    expect(screen.getByLabelText('Your name')).toHaveValue('Rahim Uddin');
    expect(screen.getByLabelText('How can we help?')).toHaveValue('');
  });

  it('shows success as soon as the request is handed off, without waiting for a slow ACK', async () => {
    const user = userEvent.setup();
    let ack: (value: unknown) => void = () => {};
    postMock.mockReturnValue(new Promise((resolve) => (ack = resolve)));
    render(<ContactForm />);
    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Send message' }));

    expect(await screen.findByRole('heading', { name: /Thank you, Rahim Uddin/ })).toBeInTheDocument();
    expect(screen.queryByText('Sending…')).toBeNull();
    expect(screen.queryByText('AB12CD34')).toBeNull();

    ack({ success: true, data: { submitted: true, reference: 'AB12CD34' } });
    expect(await screen.findByText('AB12CD34')).toBeInTheDocument();
  });

  it('hides the honeypot from assistive tech and the tab order', () => {
    const { container } = render(<ContactForm />);
    const honeypot = container.querySelector('input[name="website"]') as HTMLInputElement;
    expect(honeypot).toHaveAttribute('tabindex', '-1');
    expect(honeypot).toHaveAttribute('aria-hidden', 'true');
    expect(honeypot.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(screen.queryByRole('textbox', { name: /website/i })).toBeNull();
  });

  it('keeps what was typed and explains when the team cannot be reached', async () => {
    const user = userEvent.setup();
    postMock.mockRejectedValueOnce(new PublicApiError(429, 'RATE_LIMITED', 'Too many requests. Please try again later.'));
    render(<ContactForm />);
    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Send message' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Too many requests. Please try again later.');
    expect(screen.getByLabelText('How can we help?')).toHaveValue('I want to open a clothing store.');

    postMock.mockImplementationOnce(() => Promise.reject(new PublicApiError(500, 'INTERNAL', 'Internal server error')));
    await user.click(screen.getByRole('button', { name: 'Send message' }));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('We could not send your request right now.'),
    );
  });
});
