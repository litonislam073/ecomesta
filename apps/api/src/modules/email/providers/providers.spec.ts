import { mkdtemp, readdir, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Transporter } from 'nodemailer';
import { EmailConfigService } from '../email.config';
import { createEmailProvider } from '../email.module';
import { ConsoleEmailProvider, DisabledEmailProvider } from './console-email.provider';
import { EmailSendError, type EmailMessage } from './email-provider';
import { SmtpEmailProvider, classifySmtpError } from './smtp-email.provider';

const TOKEN = 'Zk3mQ9vX2pL7sR4tY8wB1nC6dF0gH5jK3aE7uI2oP9q';
const message: EmailMessage = {
  to: 'merchant@example.com',
  subject: 'Reset your Ecomesta password',
  html: `<a href="https://merchant.example.com/reset-password#token=${TOKEN}">Reset</a>`,
  text: `Reset: https://merchant.example.com/reset-password#token=${TOKEN}`,
  event: 'PASSWORD_RESET',
};

function configWith(values: Record<string, string | undefined>) {
  const config = { get: (key: string) => values[key] } as unknown as ConfigService;
  return new EmailConfigService(config);
}

function captureLogs() {
  const lines: string[] = [];
  const record = (...args: unknown[]) => {
    lines.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
  };
  const spies = [
    jest.spyOn(Logger.prototype, 'log').mockImplementation(record),
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(record),
    jest.spyOn(Logger.prototype, 'error').mockImplementation(record),
  ];
  return { lines, restore: () => spies.forEach((spy) => spy.mockRestore()) };
}

describe('email providers', () => {
  afterEach(() => jest.restoreAllMocks());

  it('classifies SMTP failures into safe categories', () => {
    expect(classifySmtpError({ code: 'EAUTH' }).category).toBe('authentication');
    expect(classifySmtpError({ code: 'ETIMEDOUT' }).category).toBe('timeout');
    expect(classifySmtpError({ code: 'ECONNECTION' }).category).toBe('connection');
    const rejected = classifySmtpError({ code: 'EENVELOPE', responseCode: 550 });
    expect(rejected.category).toBe('rejected');
    expect(rejected.permanent).toBe(true);
    expect(classifySmtpError(new Error('boom')).category).toBe('unknown');
    expect(classifySmtpError(new Error('boom')).permanent).toBe(false);
  });

  it('sends through the SMTP transporter with the configured sender', async () => {
    const sendMail = jest.fn().mockResolvedValue({ messageId: '<id@example>' });
    const provider = new SmtpEmailProvider(
      { host: 'smtp.example.com', port: 587, secure: false, user: 'u', password: 'p' },
      { email: 'no-reply@ecomesta.com', name: 'Ecomesta' },
      { sendMail } as unknown as Transporter,
    );
    const result = await provider.sendEmail({ ...message, replyTo: 'ada@example.com' });
    expect(result).toEqual({ delivered: true, messageId: '<id@example>' });
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: { name: 'Ecomesta', address: 'no-reply@ecomesta.com' },
        to: 'merchant@example.com',
        replyTo: 'ada@example.com',
        subject: message.subject,
      }),
    );
  });

  it('turns SMTP errors into EmailSendError without logging secrets or content', async () => {
    const logs = captureLogs();
    const secretError = Object.assign(new Error('535 auth failed for user smtp-user pass S3cretPass'), {
      code: 'EAUTH',
    });
    const provider = new SmtpEmailProvider(
      { host: 'smtp.example.com', port: 587, secure: false, user: 'smtp-user', password: 'S3cretPass' },
      { email: 'no-reply@ecomesta.com', name: 'Ecomesta' },
      { sendMail: jest.fn().mockRejectedValue(secretError) } as unknown as Transporter,
    );
    await expect(provider.sendEmail(message)).rejects.toMatchObject({
      name: 'EmailSendError',
      category: 'authentication',
    });
    const output = logs.lines.join('\n');
    logs.restore();
    expect(output).toContain('authentication');
    expect(output).not.toContain('S3cretPass');
    expect(output).not.toContain('smtp-user');
    expect(output).not.toContain(TOKEN);
    expect(output).not.toContain('merchant@example.com');
  });

  it('console mode never sends and never logs the recipient, body or token', async () => {
    const logs = captureLogs();
    const result = await new ConsoleEmailProvider(null).sendEmail(message);
    const output = logs.lines.join('\n');
    logs.restore();
    expect(result.delivered).toBe(false);
    expect(output).toContain('PASSWORD_RESET');
    expect(output).toContain('not sent');
    expect(output).not.toContain(TOKEN);
    expect(output).not.toContain('merchant@example.com');
  });

  it('console mode can write previews to a local directory instead of logging links', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'email-preview-'));
    try {
      const logs = captureLogs();
      await new ConsoleEmailProvider(dir).sendEmail(message);
      logs.restore();
      expect(logs.lines.join('\n')).not.toContain(TOKEN);
      expect(await readdir(dir)).toHaveLength(1);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('disabled mode reports non-delivery instead of pretending to send', async () => {
    expect(await new DisabledEmailProvider().sendEmail()).toEqual({ delivered: false });
  });

  it('selects the provider from EMAIL_PROVIDER_MODE with safe defaults', () => {
    expect(createEmailProvider(configWith({ NODE_ENV: 'development' })).name).toBe('console');
    expect(createEmailProvider(configWith({ NODE_ENV: 'production' })).name).toBe('disabled');
    expect(
      createEmailProvider(
        configWith({
          NODE_ENV: 'production',
          EMAIL_PROVIDER_MODE: 'smtp',
          SMTP_HOST: 'smtp.example.com',
          SMTP_PORT: '587',
          SMTP_FROM_EMAIL: 'no-reply@ecomesta.com',
        }),
      ).name,
    ).toBe('smtp');
    expect(() => createEmailProvider(configWith({ EMAIL_PROVIDER_MODE: 'smtp' }))).toThrow(/SMTP_HOST/);
  });

  it('exposes configuration status without SMTP credentials', () => {
    const status = configWith({
      EMAIL_PROVIDER_MODE: 'smtp',
      SMTP_HOST: 'smtp.example.com',
      SMTP_PORT: '465',
      SMTP_SECURE: 'true',
      SMTP_USER: 'smtp-user',
      SMTP_PASSWORD: 'S3cretPass',
      SMTP_FROM_EMAIL: 'no-reply@ecomesta.com',
      SUPPORT_EMAIL: 'support@ecomesta.com',
      APP_PUBLIC_URL: 'https://ecomesta.com/',
    }).status();
    expect(status).toMatchObject({
      mode: 'smtp',
      deliversEmail: true,
      supportEmail: 'support@ecomesta.com',
      appPublicUrl: 'https://ecomesta.com',
      smtp: { host: 'smtp.example.com', port: 465, secure: true, authConfigured: true },
    });
    const serialized = JSON.stringify(status);
    expect(serialized).not.toContain('S3cretPass');
    expect(serialized).not.toContain('smtp-user');
  });

  it('builds store URLs like the merchant app', () => {
    expect(
      configWith({ WEB_URL: 'https://ecomesta.com', PLATFORM_ROOT_DOMAIN: 'ecomesta.com' }).storeUrl('demo-store'),
    ).toBe('https://demo-store.ecomesta.com');
    expect(configWith({ WEB_URL: 'http://localhost:3000' }).storeUrl('demo-store')).toBe(
      'http://localhost:3000/?store=demo-store',
    );
  });

  it('EmailSendError carries only a category', () => {
    const error = new EmailSendError('timeout', false);
    expect(error.message).toBe('Email delivery failed (timeout)');
  });
});
