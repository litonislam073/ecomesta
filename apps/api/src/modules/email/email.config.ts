import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EMAIL_PROVIDER_MODES, type EmailProviderMode } from '../../config/env.validation';

/** Ecomesta's inbox for manual subscription payments; override with BILLING_NOTIFICATION_EMAIL. */
export const DEFAULT_BILLING_NOTIFICATION_EMAIL = 'ecomestabd@gmail.com';

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);
const DNS_LABEL = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

export interface SmtpSettings {
  host: string;
  port: number;
  secure: boolean;
  user: string | undefined;
  password: string | undefined;
}

/** Admin-safe view of the email configuration. Never includes credentials. */
export interface EmailConfigStatus {
  mode: EmailProviderMode;
  deliversEmail: boolean;
  fromEmail: string | null;
  fromName: string;
  supportEmail: string | null;
  appPublicUrl: string;
  merchantUrl: string;
  smtp: {
    host: string | null;
    port: number | null;
    secure: boolean;
    authConfigured: boolean;
  } | null;
}

/**
 * Single source for email settings. SMTP credentials are only ever read here
 * and handed to the SMTP provider; nothing else in the app sees them.
 */
@Injectable()
export class EmailConfigService {
  constructor(private readonly config: ConfigService) {}

  mode(): EmailProviderMode {
    const raw = this.value('EMAIL_PROVIDER_MODE')?.toLowerCase();
    if (raw && (EMAIL_PROVIDER_MODES as readonly string[]).includes(raw)) {
      return raw as EmailProviderMode;
    }
    return this.isProduction() ? 'disabled' : 'console';
  }

  isProduction(): boolean {
    return this.value('NODE_ENV') === 'production';
  }

  isTest(): boolean {
    return this.value('NODE_ENV') === 'test';
  }

  fromEmail(): string | null {
    return this.value('SMTP_FROM_EMAIL') ?? null;
  }

  fromName(): string {
    return this.value('SMTP_FROM_NAME') ?? 'Ecomesta';
  }

  supportEmail(): string | null {
    return this.value('SUPPORT_EMAIL') ?? null;
  }

  /** Where new manual subscription payments are reported for review. */
  billingNotificationEmail(): string {
    return this.value('BILLING_NOTIFICATION_EMAIL') ?? DEFAULT_BILLING_NOTIFICATION_EMAIL;
  }

  /** Super Admin console, linked from payment review emails. */
  adminUrl(): string {
    return trimSlash(this.value('ADMIN_URL') ?? 'http://localhost:3003');
  }

  appPublicUrl(): string {
    return trimSlash(this.value('APP_PUBLIC_URL') ?? this.value('WEB_URL') ?? 'http://localhost:3000');
  }

  merchantUrl(): string {
    return trimSlash(this.value('MERCHANT_URL') ?? 'http://localhost:3002');
  }

  logoUrl(): string {
    return `${this.appPublicUrl()}/brand/ecomesta-logo.png`;
  }

  /** Mirrors the merchant app: `{slug}.{PLATFORM_ROOT_DOMAIN}` when deployed, `?store=` on loopback. */
  storeUrl(slug: string): string {
    const web = trimSlash(this.value('WEB_URL') ?? 'http://localhost:3000');
    const rootDomain = this.value('PLATFORM_ROOT_DOMAIN')?.toLowerCase();
    try {
      const url = new URL(web);
      if (rootDomain && !LOOPBACK_HOSTS.has(url.hostname) && DNS_LABEL.test(slug)) {
        const port = url.port ? `:${url.port}` : '';
        return `${url.protocol}//${slug}.${rootDomain}${port}`;
      }
    } catch {
      // Fall through to the query-string form.
    }
    return `${web}/?store=${encodeURIComponent(slug)}`;
  }

  previewDir(): string | null {
    if (this.isProduction()) return null;
    return this.value('EMAIL_PREVIEW_DIR') ?? null;
  }

  dispatchIntervalMs(defaultMs: number): number {
    if (this.isTest()) return 0;
    const raw = this.value('EMAIL_DISPATCH_INTERVAL_MS');
    if (raw === undefined) return defaultMs;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : defaultMs;
  }

  smtp(): SmtpSettings | null {
    const host = this.value('SMTP_HOST');
    if (!host) return null;
    const port = Number(this.value('SMTP_PORT') ?? '587');
    return {
      host,
      port: Number.isInteger(port) && port > 0 ? port : 587,
      secure: this.value('SMTP_SECURE') === 'true',
      user: this.value('SMTP_USER'),
      password: this.value('SMTP_PASSWORD'),
    };
  }

  status(): EmailConfigStatus {
    const mode = this.mode();
    const smtp = this.smtp();
    return {
      mode,
      deliversEmail: mode === 'smtp' && smtp !== null && this.fromEmail() !== null,
      fromEmail: this.fromEmail(),
      fromName: this.fromName(),
      supportEmail: this.supportEmail(),
      appPublicUrl: this.appPublicUrl(),
      merchantUrl: this.merchantUrl(),
      smtp:
        mode === 'smtp'
          ? {
              host: smtp?.host ?? null,
              port: smtp?.port ?? null,
              secure: smtp?.secure ?? false,
              authConfigured: Boolean(smtp?.user && smtp?.password),
            }
          : null,
    };
  }

  private value(key: string): string | undefined {
    const raw = this.config.get<string | number>(key);
    if (raw === undefined || raw === null) return undefined;
    const text = String(raw).trim();
    return text === '' ? undefined : text;
  }
}

function trimSlash(url: string): string {
  return url.replace(/\/+$/, '');
}
