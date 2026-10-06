import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AiSupportLauncher } from '@/components/ai-support/ai-support-launcher';
import { isAiSupportHost, parseReply, replyPacing, splitBold, splitInline } from '@/lib/ai-support';

const postMock = vi.fn();
/** Starting a chat, kept apart so each test's chat mock only sees chat traffic. */
const startMock = vi.fn();
const CREDENTIALS = { conversationId: 'c0ffee00-0000-4000-8000-000000000001', conversationToken: 'secret-token-0123456789' };
vi.mock('@/lib/public-api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/public-api')>('@/lib/public-api');
  return {
    ...actual,
    publicPost: (...args: unknown[]) => (args[0] === '/ai-support/conversations' ? startMock(...args) : postMock(...args)),
  };
});

const { PublicApiError } = await vi.importActual<typeof import('@/lib/public-api')>('@/lib/public-api');

function ok(reply: string, handoff: { reason: string } | null = null) {
  return Promise.resolve({ success: true, data: { reply, handoff, language: 'en' } });
}

async function openLauncher() {
  const user = userEvent.setup();
  render(<AiSupportLauncher />);
  await user.click(await screen.findByRole('button', { name: 'Open Ecomesta support chat' }));
  const dialog = await screen.findByRole('dialog', { name: 'Ecomesta Support' });
  return { user, dialog };
}

/** Opens the chat and fills in the required start-chat details. */
async function openChat(details: { name?: string; phone?: string; email?: string } = {}) {
  const { user, dialog } = await openLauncher();
  const form = await within(dialog).findByRole('form', { name: 'Start a chat' });
  await user.type(within(form).getByLabelText('Your name'), details.name ?? 'Rahim');
  await user.type(within(form).getByLabelText('Phone number'), details.phone ?? '01711000000');
  if (details.email) await user.type(within(form).getByLabelText('Email (optional)'), details.email);
  await user.click(within(form).getByRole('button', { name: 'Start chat' }));
  await within(dialog).findByLabelText('Message Ecomesta Support');
  return { user, dialog };
}

const chatCalls = () => postMock.mock.calls.filter(([path]) => path === '/ai-support/chat');

describe('where the AI support agent may appear', () => {
  it.each([
    ['localhost', true],
    ['127.0.0.1', true],
    ['ecomesta.com', true],
    ['www.ecomesta.com', true],
    ['ecomesta.local', true],
    ['mystore.ecomesta.com', false],
    ['demo-store.ecomesta.local', false],
    ['shop.example.com', false],
    ['www.myshop.com.bd', false],
    ['mystore.localhost', false],
  ])('%s → %s', (host, expected) => {
    expect(isAiSupportHost(host)).toBe(expected);
  });

  it('is never imported by storefront routes or storefront components', () => {
    const roots = [join(__dirname, '../../app/(store)'), join(__dirname, '../storefront')];
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (/\.(tsx?|jsx?)$/.test(name)) files.push(path);
      }
    };
    roots.forEach(walk);
    for (const extra of ['storefront-home.tsx', 'storefront-providers.tsx', 'checkout-form.tsx', 'track-order-form.tsx']) {
      files.push(join(__dirname, '..', extra));
    }
    expect(files.length).toBeGreaterThan(10);
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      expect({ file, ai: /ai-support/.test(source) }).toEqual({ file, ai: false });
      expect({ file, shell: /MarketingShell/.test(source) }).toEqual({ file, shell: false });
    }
  });

  it('renders nothing when the host is not the platform website', async () => {
    const spy = vi.spyOn(await import('@/lib/ai-support'), 'isAiSupportHost').mockReturnValue(false);
    try {
      const { container } = render(<AiSupportLauncher />);
      await act(async () => {});
      expect(container).toBeEmptyDOMElement();
      expect(screen.queryByRole('button', { name: /support chat/ })).toBeNull();
    } finally {
      spy.mockRestore();
    }
  });
});

describe('reply formatting', () => {
  it('turns lines into paragraphs and lists without HTML', () => {
    expect(parseReply('Hi there.\n\n1. Open Domains\n2. Add your domain\n- Note one')).toEqual([
      { type: 'paragraph', text: 'Hi there.' },
      { type: 'list', ordered: true, items: ['Open Domains', 'Add your domain'] },
      { type: 'list', ordered: false, items: ['Note one'] },
    ]);
    expect(splitBold('Use **Growth** plan')).toEqual([
      { text: 'Use ', bold: false },
      { text: 'Growth', bold: true },
      { text: ' plan', bold: false },
    ]);
  });

  it('links only Ecomesta pages, from markdown links, full URLs and bare paths', () => {
    expect(splitInline('See [pricing](https://ecomesta.com/pricing) or /features/custom-domain.')).toEqual([
      { text: 'See ', bold: false },
      { text: 'pricing', bold: false, href: '/pricing' },
      { text: ' or ', bold: false },
      { text: '/features/custom-domain', bold: false, href: '/features/custom-domain' },
      { text: '.', bold: false },
    ]);
    expect(splitInline('দেখুন: /faq।').find((part) => part.href)).toEqual({ text: '/faq', bold: false, href: '/faq' });
    // Other sites, scripts and unknown paths stay plain text.
    for (const text of ['[click](https://evil.example/pricing)', '[x](javascript:alert(1))', 'Open /admin/users', '৳99/month']) {
      expect(splitInline(text).some((part) => part.href)).toBe(false);
    }
  });
});

const realPacing = { ...replyPacing };

describe('AI support chat', () => {
  beforeEach(() => {
    postMock.mockReset();
    startMock.mockReset();
    startMock.mockResolvedValue({ success: true, data: CREDENTIALS });
    window.sessionStorage.clear();
    // Most tests are about the conversation, not the typing speed.
    Object.assign(replyPacing, { minThinkMs: 0, maxThinkMs: 0, thinkMsPerChar: 0, maxTypeMs: 0 });
  });
  afterEach(() => {
    cleanup();
    Object.assign(replyPacing, realPacing);
  });

  it('types the reply like a person: typing dots first, then the text appears gradually', async () => {
    Object.assign(replyPacing, { minThinkMs: 300, maxThinkMs: 300, thinkMsPerChar: 0, maxTypeMs: 900, charsPerSecond: 1 });
    const reply = 'প্ল্যান মাসে ৳99 থেকে শুরু, স্টোর খোলার সময় পেমেন্ট করতে হয়।';
    postMock.mockImplementation(() => ok(reply));
    const { user, dialog } = await openChat();
    await user.type(within(dialog).getByLabelText('Message Ecomesta Support'), 'Price koto?{Enter}');
    // The answer is back immediately, but a person takes a moment: dots, no text yet.
    expect(await within(dialog).findByRole('status', { name: 'Ecomesta Support is typing' })).toBeInTheDocument();
    expect(within(dialog).queryByText(reply)).toBeNull();
    // Then it is typed out: part of the reply is visible before all of it.
    await waitFor(() => {
      const shown = dialog.querySelector('[data-typing]')?.textContent ?? '';
      expect(shown.length).toBeGreaterThan(0);
      expect(shown.length).toBeLessThan(reply.length);
      expect(reply.startsWith(shown)).toBe(true);
    });
    expect(within(dialog).getByRole('button', { name: 'Send message' })).toBeDisabled();
    expect(await within(dialog).findByText(reply, {}, { timeout: 3000 })).toBeInTheDocument();
    expect(dialog.querySelector('[data-typing]')).toBeNull();
  });

  it('shows the finished reply in one place, never as a complete "typing" element that is then replaced', async () => {
    const reply = 'Back online.';
    postMock.mockImplementation(() => ok(reply));
    const { user, dialog } = await openChat();
    // Every DOM change is recorded, so a full-text typing element is caught even
    // if it only exists for a single render.
    let fullTextWhileTyping = false;
    const observer = new MutationObserver(() => {
      if (dialog.querySelector('[data-typing]')?.textContent === reply) fullTextWhileTyping = true;
    });
    observer.observe(dialog, { subtree: true, childList: true, characterData: true });
    try {
      await user.type(within(dialog).getByLabelText('Message Ecomesta Support'), 'Hello{Enter}');
      const shown = await within(dialog).findByText(reply);
      // Send only enables once the reply is no longer pending (typing finished).
      await user.type(within(dialog).getByLabelText('Message Ecomesta Support'), 'x');
      await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Send message' })).toBeEnabled());
      // Typing has fully settled and the element first found is still the reply.
      expect(fullTextWhileTyping).toBe(false);
      expect(shown).toBeInTheDocument();
    } finally {
      observer.disconnect();
    }
  });

  it('asks for name and phone before the chat starts; email is optional', async () => {
    const { user, dialog } = await openLauncher();
    const form = await within(dialog).findByRole('form', { name: 'Start a chat' });
    // No way to send a message yet.
    expect(within(dialog).queryByLabelText('Message Ecomesta Support')).toBeNull();
    expect(within(dialog).queryByRole('group', { name: 'Suggested questions' })).toBeNull();
    await waitFor(() => expect(within(form).getByLabelText('Your name')).toHaveFocus());

    await user.click(within(form).getByRole('button', { name: 'Start chat' }));
    expect(within(form).getByText('Please enter your name.')).toBeInTheDocument();
    expect(within(form).getByText('Please enter your phone number.')).toBeInTheDocument();
    expect(within(form).getByLabelText('Your name')).toHaveAttribute('aria-invalid', 'true');

    await user.type(within(form).getByLabelText('Your name'), 'Rahim Uddin');
    await user.type(within(form).getByLabelText('Phone number'), '123');
    await user.type(within(form).getByLabelText('Email (optional)'), 'not-an-email');
    await user.click(within(form).getByRole('button', { name: 'Start chat' }));
    expect(within(form).getByText('Please enter a valid phone number.')).toBeInTheDocument();
    expect(within(form).getByText('Please enter a valid email or leave it empty.')).toBeInTheDocument();
    expect(within(dialog).queryByLabelText('Message Ecomesta Support')).toBeNull();

    // A valid phone and no email is enough.
    await user.clear(within(form).getByLabelText('Phone number'));
    await user.type(within(form).getByLabelText('Phone number'), '01711-000000');
    await user.clear(within(form).getByLabelText('Email (optional)'));
    await user.click(within(form).getByRole('button', { name: 'Start chat' }));
    expect(within(dialog).queryByRole('form', { name: 'Start a chat' })).toBeNull();
    expect(within(dialog).getByText(/^Hi Rahim! Welcome to Ecomesta/)).toBeInTheDocument();
    await waitFor(() => expect(within(dialog).getByLabelText('Message Ecomesta Support')).toHaveFocus());
    // The chat is started on the server with the details (phone without formatting, no empty email)...
    expect(startMock).toHaveBeenCalledTimes(1);
    expect(startMock.mock.calls[0]![1]).toEqual({ name: 'Rahim Uddin', phone: '01711000000' });
    expect(JSON.parse(window.sessionStorage.getItem('ecomesta_ai_support_visitor_v1')!)).toEqual({
      name: 'Rahim Uddin',
      phone: '01711-000000',
      email: '',
      ...CREDENTIALS,
    });
    // ...and each message names that chat; the details themselves are not repeated (or sent to the model).
    postMock.mockImplementation(() => ok('Hello!'));
    await user.type(within(dialog).getByLabelText('Message Ecomesta Support'), 'Hi{Enter}');
    await within(dialog).findByText('Hello!');
    expect(chatCalls()[0]![1]).toEqual({ messages: [{ role: 'user', content: 'Hi' }], ...CREDENTIALS });
  });

  it('keeps the form open with a message when the chat cannot be started', async () => {
    startMock.mockRejectedValue(new PublicApiError(503, 'SERVICE_UNAVAILABLE', 'Service unavailable'));
    const { user, dialog } = await openLauncher();
    const form = await within(dialog).findByRole('form', { name: 'Start a chat' });
    await user.type(within(form).getByLabelText('Your name'), 'Rahim');
    await user.type(within(form).getByLabelText('Phone number'), '01711000000');
    await user.click(within(form).getByRole('button', { name: 'Start chat' }));
    expect(await within(form).findByRole('alert')).toHaveTextContent('could not start the chat');
    expect(within(dialog).queryByLabelText('Message Ecomesta Support')).toBeNull();
  });

  it('asks to start again, details filled in, when the server no longer knows the chat', async () => {
    postMock.mockRejectedValue(new PublicApiError(404, 'CHAT_NOT_FOUND', 'This chat has ended. Please start a new chat.'));
    const { user, dialog } = await openChat({ name: 'Rahim', phone: '01711000000' });
    await user.type(within(dialog).getByLabelText('Message Ecomesta Support'), 'Hello{Enter}');
    const form = await within(dialog).findByRole('form', { name: 'Start a chat' });
    expect(within(form).getByText('This chat has ended. Please start a new chat.')).toBeInTheDocument();
    expect(within(form).getByLabelText('Your name')).toHaveValue('Rahim');
    expect(within(form).getByLabelText('Phone number')).toHaveValue('01711000000');
    expect(window.sessionStorage.getItem('ecomesta_ai_support_visitor_v1')).toBeNull();

    await user.click(within(form).getByRole('button', { name: 'Start chat' }));
    expect(await within(dialog).findByLabelText('Message Ecomesta Support')).toBeInTheDocument();
    expect(startMock).toHaveBeenCalledTimes(2);
  });

  it('does not ask again in the same tab once the details are given', async () => {
    window.sessionStorage.setItem(
      'ecomesta_ai_support_visitor_v1',
      JSON.stringify({ name: 'Karim', phone: '01911000111', email: '', ...CREDENTIALS }),
    );
    const { dialog } = await openLauncher();
    expect(await within(dialog).findByLabelText('Message Ecomesta Support')).toBeInTheDocument();
    expect(within(dialog).queryByRole('form', { name: 'Start a chat' })).toBeNull();
    expect(within(dialog).getByText(/^Hi Karim!/)).toBeInTheDocument();
  });

  it('keeps the conversation after a page reload, also under React Strict Mode', async () => {
    const saved = [
      { id: 'u1', role: 'user', content: 'How much is the Starter plan?' },
      { id: 'a1', role: 'assistant', content: 'Starter is ৳99 a month.' },
    ];
    window.sessionStorage.setItem('ecomesta_ai_support_v1', JSON.stringify(saved));
    window.sessionStorage.setItem(
      'ecomesta_ai_support_visitor_v1',
      JSON.stringify({ name: 'Karim', phone: '01911000111', email: '', ...CREDENTIALS }),
    );
    const user = userEvent.setup();
    // Strict Mode mounts effects twice, as the dev server does.
    render(
      <StrictMode>
        <AiSupportLauncher />
      </StrictMode>,
    );
    await user.click(await screen.findByRole('button', { name: 'Open Ecomesta support chat' }));
    const dialog = await screen.findByRole('dialog', { name: 'Ecomesta Support' });
    expect(await within(dialog).findByText('How much is the Starter plan?')).toBeInTheDocument();
    expect(within(dialog).getByText('Starter is ৳99 a month.')).toBeInTheDocument();
    expect(JSON.parse(window.sessionStorage.getItem('ecomesta_ai_support_v1')!)).toEqual(saved);
  });

  it('shows the launcher on the platform website and opens the chat', async () => {
    const { dialog } = await openChat();
    expect(within(dialog).getByText(/Welcome to Ecomesta/)).toBeInTheDocument();
    // Presented as Ecomesta support, not as an "AI" product.
    expect(dialog.textContent).not.toMatch(/\bAI\b/);
    await waitFor(() => expect(within(dialog).getByLabelText('Message Ecomesta Support')).toHaveFocus());
  });

  it('sends a message and shows the reply', async () => {
    postMock.mockImplementation(() => ok('Yes! You can open a store in a few minutes.'));
    const { user, dialog } = await openChat();
    await user.type(within(dialog).getByLabelText('Message Ecomesta Support'), 'Can I open a store?{Enter}');
    expect(await within(dialog).findByText('Yes! You can open a store in a few minutes.')).toBeInTheDocument();
    expect(chatCalls()[0]![1]).toEqual({ messages: [{ role: 'user', content: 'Can I open a store?' }], ...CREDENTIALS });
  });

  it('keeps Bangla and Banglish text exactly as typed', async () => {
    postMock.mockImplementation(() => ok('হ্যাঁ, পারবেন।'));
    const { user, dialog } = await openChat();
    await user.type(within(dialog).getByLabelText('Message Ecomesta Support'), 'আমি কি স্টোর খুলতে পারব?{Enter}');
    expect(await within(dialog).findByText('হ্যাঁ, পারবেন।')).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText('Message Ecomesta Support'), 'amar store e product add korte parbo?{Enter}');
    await waitFor(() => expect(chatCalls()).toHaveLength(2));
    expect((chatCalls()[1]![1] as { messages: { content: string }[] }).messages.at(-1)!.content).toBe(
      'amar store e product add korte parbo?',
    );
  });

  it('sends the whole conversation for follow-up questions', async () => {
    postMock
      .mockImplementationOnce(() => ok('Growth is for growing stores.'))
      .mockImplementationOnce(() => ok('৳2,691 per year.'));
    const { user, dialog } = await openChat();
    const input = within(dialog).getByLabelText('Message Ecomesta Support');
    await user.type(input, 'What is the Growth plan?{Enter}');
    await within(dialog).findByText('Growth is for growing stores.');
    await user.type(input, 'How much yearly?{Enter}');
    await within(dialog).findByText('৳2,691 per year.');
    expect(chatCalls()[1]![1]).toEqual({
      messages: [
        { role: 'user', content: 'What is the Growth plan?' },
        { role: 'assistant', content: 'Growth is for growing stores.' },
        { role: 'user', content: 'How much yearly?' },
      ],
      ...CREDENTIALS,
    });
  });

  it('uses Shift+Enter for a new line instead of sending', async () => {
    const { user, dialog } = await openChat();
    const input = within(dialog).getByLabelText('Message Ecomesta Support');
    await user.type(input, 'line one{Shift>}{Enter}{/Shift}line two');
    expect(input).toHaveValue('line one\nline two');
    expect(chatCalls()).toHaveLength(0);
  });

  it('shows a friendly error with retry when the assistant is unavailable', async () => {
    postMock
      .mockImplementationOnce(() => Promise.reject(new PublicApiError(500, 'INTERNAL_SERVER_ERROR', 'Internal server error')))
      .mockImplementationOnce(() => ok('Back online.'));
    const { user, dialog } = await openChat();
    await user.type(within(dialog).getByLabelText('Message Ecomesta Support'), 'Hello{Enter}');
    const alert = await within(dialog).findByRole('alert');
    expect(alert).toHaveTextContent("I'm having trouble responding right now.");
    expect(alert).not.toHaveTextContent(/500|Internal/);
    await user.click(within(alert).getByRole('button', { name: 'Try again' }));
    expect(await within(dialog).findByText('Back online.')).toBeInTheDocument();
    expect((chatCalls()[1]![1] as { messages: unknown[] }).messages).toEqual([{ role: 'user', content: 'Hello' }]);
  });

  it('shows the rate limit message from the API', async () => {
    postMock.mockImplementation(() =>
      Promise.reject(new PublicApiError(429, 'RATE_LIMITED', "You're sending messages very quickly. Please wait a little and try again.")),
    );
    const { user, dialog } = await openChat();
    await user.type(within(dialog).getByLabelText('Message Ecomesta Support'), 'hi{Enter}');
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('sending messages very quickly');
  });

  it('shows page links in replies as real links', async () => {
    postMock.mockImplementation(() => ok('Read more on [our pricing page](https://ecomesta.com/pricing).'));
    const { user, dialog } = await openChat();
    await user.type(within(dialog).getByLabelText('Message Ecomesta Support'), 'Price?{Enter}');
    expect(await within(dialog).findByRole('link', { name: 'our pricing page' })).toHaveAttribute('href', '/pricing');
    expect(within(dialog).queryByText(/\]\(/)).toBeNull();
  });

  it('clears the conversation', async () => {
    postMock.mockImplementation(() => ok('Answer.'));
    const { user, dialog } = await openChat();
    await user.type(within(dialog).getByLabelText('Message Ecomesta Support'), 'Question{Enter}');
    await within(dialog).findByText('Answer.');
    await user.click(within(dialog).getByRole('button', { name: 'Clear conversation' }));
    expect(within(dialog).queryByText('Answer.')).toBeNull();
    expect(window.sessionStorage.getItem('ecomesta_ai_support_v1')).toBeNull();
  });

  it('closes with Escape, returns focus to the launcher and keeps the conversation on reopen', async () => {
    postMock.mockImplementation(() => ok('Kept answer.'));
    const { user, dialog } = await openChat();
    await user.type(within(dialog).getByLabelText('Message Ecomesta Support'), 'Keep this{Enter}');
    await within(dialog).findByText('Kept answer.');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    const launcher = screen.getByRole('button', { name: 'Open Ecomesta support chat' });
    await waitFor(() => expect(launcher).toHaveFocus());
    await user.click(launcher);
    expect(await screen.findByText('Kept answer.')).toBeInTheDocument();
  });

  it('offers human support and only confirms after the request is sent', async () => {
    postMock.mockImplementation((path: string) =>
      path === '/ai-support/chat'
        ? ok('A person from our team can help. Please fill in the form below.', { reason: 'Refund question' })
        : Promise.resolve({ success: true, data: { submitted: true, reference: 'AB12CD34' } }),
    );
    const { user, dialog } = await openChat({ name: 'Rahim', phone: '01711000000', email: 'rahim@example.com' });
    await user.type(within(dialog).getByLabelText('Message Ecomesta Support'), 'I need a refund from a person{Enter}');
    const form = await within(dialog).findByRole('form', { name: 'Contact our support team' });
    // Filled in from the start-chat details.
    expect(within(form).getByLabelText('Name')).toHaveValue('Rahim');
    expect(within(form).getByLabelText('Phone number')).toHaveValue('01711000000');
    expect(within(form).getByLabelText('Email (optional)')).toHaveValue('rahim@example.com');
    expect(within(form).getByLabelText('How can we help?')).toHaveValue('I need a refund from a person');
    await user.click(within(form).getByRole('button', { name: 'Send to support' }));
    expect(await within(dialog).findByRole('status', { name: '' })).toHaveTextContent(
      'Sent to our support team (reference #AB12CD34). We will reply to rahim@example.com.',
    );
    const [, body] = postMock.mock.calls.find(([path]) => path === '/ai-support/handoff')!;
    expect(body).toMatchObject({ name: 'Rahim', phone: '01711000000', email: 'rahim@example.com', reason: 'Refund question', ...CREDENTIALS });
  });

  it('sends a support request with only a phone number', async () => {
    postMock.mockImplementation((path: string) =>
      path === '/ai-support/chat'
        ? ok('A person can help. Please fill in the form below.', { reason: 'Call back' })
        : Promise.resolve({ success: true, data: { submitted: true, reference: 'PH0NE123' } }),
    );
    const { user, dialog } = await openChat({ name: 'Salma', phone: '01811 222 333' });
    await user.type(within(dialog).getByLabelText('Message Ecomesta Support'), 'Please call me back about pricing{Enter}');
    const form = await within(dialog).findByRole('form', { name: 'Contact our support team' });
    await user.click(within(form).getByRole('button', { name: 'Send to support' }));
    expect(await within(dialog).findByRole('status', { name: '' })).toHaveTextContent(
      'Sent to our support team (reference #PH0NE123). We will contact you on 01811 222 333.',
    );
    const [, body] = postMock.mock.calls.find(([path]) => path === '/ai-support/handoff')!;
    expect(body).toMatchObject({ name: 'Salma', phone: '01811222333' });
    expect(body).not.toHaveProperty('email');
  });

  it('requires a phone number in the support form', async () => {
    postMock.mockImplementation(() => ok('Please fill in the form below.', { reason: 'Help' }));
    const { user, dialog } = await openChat();
    await user.type(within(dialog).getByLabelText('Message Ecomesta Support'), 'Talk to a person please{Enter}');
    const form = await within(dialog).findByRole('form', { name: 'Contact our support team' });
    await user.clear(within(form).getByLabelText('Phone number'));
    await user.click(within(form).getByRole('button', { name: 'Send to support' }));
    expect(within(form).getByRole('alert')).toHaveTextContent('valid phone number');
    expect(postMock.mock.calls.find(([path]) => path === '/ai-support/handoff')).toBeUndefined();
  });

  it('says honestly when the support request fails', async () => {
    postMock.mockImplementation((path: string) =>
      path === '/ai-support/chat'
        ? ok('Please fill in the form below.', { reason: 'Help' })
        : Promise.reject(new PublicApiError(500, 'INTERNAL_SERVER_ERROR', 'Internal server error')),
    );
    const { user, dialog } = await openChat({ email: 'rahim@example.com' });
    await user.type(within(dialog).getByLabelText('Message Ecomesta Support'), 'Talk to a person please{Enter}');
    const form = await within(dialog).findByRole('form', { name: 'Contact our support team' });
    await user.click(within(form).getByRole('button', { name: 'Send to support' }));
    expect(await within(form).findByRole('alert')).toHaveTextContent('could not send your request');
    expect(within(dialog).queryByText(/Sent to our support team/)).toBeNull();
  });
});
