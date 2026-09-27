import { Global, Logger, Module, type OnApplicationBootstrap, Inject } from '@nestjs/common';
import { AuthTokensModule } from '../auth-tokens/auth-tokens.module';
import { EmailComposer } from './email-composer.service';
import { EmailDispatcher } from './email-dispatcher.service';
import { EmailConfigService } from './email.config';
import { EmailService } from './email.service';
import { EmailStatusService } from './email-status.service';
import { ConsoleEmailProvider, DisabledEmailProvider } from './providers/console-email.provider';
import { EMAIL_PROVIDER, type EmailProvider } from './providers/email-provider';
import { SmtpEmailProvider } from './providers/smtp-email.provider';

export function createEmailProvider(config: EmailConfigService): EmailProvider {
  const mode = config.mode();
  if (mode === 'smtp') {
    const smtp = config.smtp();
    const fromEmail = config.fromEmail();
    if (!smtp || !fromEmail) {
      throw new Error('EMAIL_PROVIDER_MODE=smtp requires SMTP_HOST and SMTP_FROM_EMAIL');
    }
    return new SmtpEmailProvider(smtp, { email: fromEmail, name: config.fromName() });
  }
  if (mode === 'console') {
    return new ConsoleEmailProvider(config.previewDir());
  }
  return new DisabledEmailProvider();
}

@Global()
@Module({
  imports: [AuthTokensModule],
  providers: [
    EmailConfigService,
    {
      provide: EMAIL_PROVIDER,
      inject: [EmailConfigService],
      useFactory: createEmailProvider,
    },
    EmailComposer,
    EmailDispatcher,
    EmailService,
    EmailStatusService,
  ],
  exports: [EmailService, EmailConfigService, EmailStatusService],
})
export class EmailModule implements OnApplicationBootstrap {
  private readonly logger = new Logger('Email');

  constructor(
    private readonly config: EmailConfigService,
    @Inject(EMAIL_PROVIDER) private readonly provider: EmailProvider,
  ) {}

  onApplicationBootstrap(): void {
    const mode = this.config.mode();
    if (mode === 'smtp') {
      this.logger.log('Email provider configured: SMTP');
      if (this.provider instanceof SmtpEmailProvider && !this.config.isTest()) {
        void this.provider.verify().then((ok) => {
          if (ok) this.logger.log('SMTP connection verified');
        });
      }
    } else if (mode === 'console') {
      this.logger.log('Email provider configured: console (emails are logged, not sent)');
    } else {
      this.logger.warn('Email delivery is disabled (set EMAIL_PROVIDER_MODE=smtp to send email)');
    }
  }
}
