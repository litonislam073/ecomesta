export const EMAIL_PROVIDER = Symbol('EMAIL_PROVIDER');

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  /** Safe metadata for provider logs (never the body or addresses). */
  event: string;
}

export interface EmailSendResult {
  /** False when the provider intentionally did not deliver (console/disabled). */
  delivered: boolean;
  messageId?: string;
}

export type EmailErrorCategory =
  | 'configuration'
  | 'authentication'
  | 'connection'
  | 'timeout'
  | 'rejected'
  | 'unknown';

/** Provider failure with a safe category; the original error is never persisted. */
export class EmailSendError extends Error {
  constructor(
    readonly category: EmailErrorCategory,
    /** Permanent failures (bad recipient, bad config) are not retried. */
    readonly permanent: boolean,
  ) {
    super(`Email delivery failed (${category})`);
    this.name = 'EmailSendError';
  }
}

/**
 * Delivery backend. Implementations must not log message bodies, recipient
 * addresses or credentials. Swap in Resend/SES/SendGrid/Mailgun by adding an
 * implementation and selecting it in EmailModule.
 */
export interface EmailProvider {
  readonly name: string;
  sendEmail(message: EmailMessage): Promise<EmailSendResult>;
}
