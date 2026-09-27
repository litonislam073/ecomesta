import { Logger } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';
import type { SmtpSettings } from '../email.config';
import {
  EmailSendError,
  type EmailErrorCategory,
  type EmailMessage,
  type EmailProvider,
  type EmailSendResult,
} from './email-provider';

const CONNECTION_CODES = new Set(['ECONNECTION', 'ESOCKET', 'EDNS', 'ECONNREFUSED', 'ECONNRESET', 'EHOSTUNREACH']);
const TIMEOUT_CODES = new Set(['ETIMEDOUT', 'ETIMEOUT']);

/** Maps a Nodemailer error to a safe category without keeping its message. */
export function classifySmtpError(error: unknown): EmailSendError {
  const err = (error ?? {}) as { code?: unknown; responseCode?: unknown };
  const code = typeof err.code === 'string' ? err.code : '';
  const responseCode = typeof err.responseCode === 'number' ? err.responseCode : 0;

  let category: EmailErrorCategory = 'unknown';
  let permanent = false;
  if (code === 'EAUTH' || responseCode === 535 || responseCode === 534) {
    category = 'authentication';
  } else if (TIMEOUT_CODES.has(code)) {
    category = 'timeout';
  } else if (CONNECTION_CODES.has(code)) {
    category = 'connection';
  } else if (code === 'EENVELOPE' || (responseCode >= 550 && responseCode <= 554)) {
    category = 'rejected';
    permanent = true;
  } else if (code === 'ECONFIG') {
    category = 'configuration';
    permanent = true;
  }
  return new EmailSendError(category, permanent);
}

export class SmtpEmailProvider implements EmailProvider {
  readonly name = 'smtp';
  private readonly logger = new Logger(SmtpEmailProvider.name);
  private readonly transporter: Transporter;

  constructor(
    settings: SmtpSettings,
    private readonly from: { email: string; name: string },
    transporter?: Transporter,
  ) {
    this.transporter =
      transporter ??
      createTransport({
        host: settings.host,
        port: settings.port,
        secure: settings.secure,
        requireTLS: !settings.secure,
        auth:
          settings.user && settings.password
            ? { user: settings.user, pass: settings.password }
            : undefined,
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 20_000,
        logger: false,
        debug: false,
      });
  }

  async sendEmail(message: EmailMessage): Promise<EmailSendResult> {
    try {
      const info = (await this.transporter.sendMail({
        from: { name: this.from.name, address: this.from.email },
        to: message.to,
        replyTo: message.replyTo,
        subject: message.subject,
        html: message.html,
        text: message.text,
        headers: { 'X-Ecomesta-Event': message.event },
      })) as { messageId?: string };
      return { delivered: true, messageId: info.messageId };
    } catch (error) {
      const classified = classifySmtpError(error);
      this.logger.warn(`SMTP send failed for ${message.event}: ${classified.category}`);
      throw classified;
    }
  }

  /** Startup connectivity check; logs only the outcome category. */
  async verify(): Promise<boolean> {
    try {
      await this.transporter.verify();
      return true;
    } catch (error) {
      this.logger.warn(`SMTP verification failed: ${classifySmtpError(error).category}`);
      return false;
    }
  }
}
