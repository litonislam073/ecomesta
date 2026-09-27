import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { Logger } from '@nestjs/common';
import type { EmailMessage, EmailProvider, EmailSendResult } from './email-provider';

/**
 * Development/test provider: never sends. Logs the event and subject only —
 * never the recipient, body or links, because bodies can carry reset tokens.
 * With EMAIL_PREVIEW_DIR set (refused in production) the rendered HTML is
 * written to disk so developers can open links locally.
 */
export class ConsoleEmailProvider implements EmailProvider {
  readonly name = 'console';
  private readonly logger = new Logger(ConsoleEmailProvider.name);

  constructor(private readonly previewDir: string | null) {}

  async sendEmail(message: EmailMessage): Promise<EmailSendResult> {
    let preview = '';
    if (this.previewDir) {
      await mkdir(this.previewDir, { recursive: true });
      const file = join(this.previewDir, `${Date.now()}-${message.event.toLowerCase()}.html`);
      await writeFile(file, message.html, 'utf8');
      preview = ` (preview written to EMAIL_PREVIEW_DIR)`;
    }
    this.logger.log(`[console email, not sent] ${message.event}: "${message.subject}"${preview}`);
    return { delivered: false };
  }
}

/** Production default until SMTP is configured: records deliveries as skipped. */
export class DisabledEmailProvider implements EmailProvider {
  readonly name = 'disabled';

  async sendEmail(): Promise<EmailSendResult> {
    return { delivered: false };
  }
}
