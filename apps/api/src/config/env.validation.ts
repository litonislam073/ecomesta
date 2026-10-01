import { plainToInstance } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  Min,
  validateSync,
} from 'class-validator';

export const EMAIL_PROVIDER_MODES = ['smtp', 'console', 'disabled'] as const;
export type EmailProviderMode = (typeof EMAIL_PROVIDER_MODES)[number];

enum NodeEnvironment {
  Development = 'development',
  Test = 'test',
  Production = 'production',
}

export class EnvironmentVariables {
  @IsEnum(NodeEnvironment)
  NODE_ENV: NodeEnvironment = NodeEnvironment.Development;

  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  @IsString()
  @IsNotEmpty()
  REDIS_URL!: string;

  @IsString()
  @IsNotEmpty()
  JWT_ACCESS_SECRET!: string;

  @IsString()
  @IsNotEmpty()
  JWT_REFRESH_SECRET!: string;

  @IsOptional()
  @IsString()
  JWT_ACCESS_EXPIRES_IN?: string;

  @IsOptional()
  @IsString()
  JWT_REFRESH_EXPIRES_IN?: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  API_PORT!: number;

  @IsUrl({ require_tld: false })
  API_URL!: string;

  @IsUrl({ require_tld: false })
  WEB_URL!: string;

  @IsUrl({ require_tld: false })
  MERCHANT_URL!: string;

  @IsUrl({ require_tld: false })
  ADMIN_URL!: string;

  @IsOptional()
  @IsString()
  CORS_ORIGINS?: string;

  /**
   * Root domain that stores get `{slug}.{root}` storefront subdomains under.
   * Defaults to `ecomesta.local` for local development; set `ecomesta.com`
   * (or the deployment's own apex) in production.
   */
  @IsOptional()
  @IsString()
  PLATFORM_ROOT_DOMAIN?: string;

  @IsOptional()
  @IsString()
  LOG_LEVEL?: string;

  @IsOptional()
  @IsString()
  S3_ENDPOINT?: string;

  @IsOptional()
  @IsString()
  S3_ACCESS_KEY?: string;

  @IsOptional()
  @IsString()
  S3_SECRET_KEY?: string;

  @IsOptional()
  @IsString()
  S3_BUCKET?: string;

  @IsOptional()
  @IsString()
  S3_REGION?: string;

  /**
   * AES-256-GCM key for payment provider secrets at rest.
   * Prefer 64-char hex (32 bytes). Passphrases are SHA-256 derived.
   * Required in production.
   */
  @IsOptional()
  @IsString()
  PAYMENT_SECRETS_ENCRYPTION_KEY?: string;

  /**
   * When true (or TRUSTED_PROXY_HOPS >= 1), API host helpers may honor
   * X-Forwarded-Host. Nginx must overwrite that header from $host.
   */
  @IsOptional()
  @IsString()
  TRUST_PROXY?: string;

  @IsOptional()
  @IsString()
  TRUSTED_PROXY_HOPS?: string;

  /**
   * `smtp` delivers through SMTP_*; `console` logs safe metadata only
   * (development/test); `disabled` records deliveries as skipped. Defaults to
   * `console` outside production and `disabled` in production.
   */
  @IsOptional()
  @IsIn(EMAIL_PROVIDER_MODES)
  EMAIL_PROVIDER_MODE?: EmailProviderMode;

  @IsOptional()
  @IsString()
  SMTP_HOST?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  SMTP_PORT?: number;

  @IsOptional()
  @IsString()
  SMTP_USER?: string;

  @IsOptional()
  @IsString()
  SMTP_PASSWORD?: string;

  @IsOptional()
  @IsEmail()
  SMTP_FROM_EMAIL?: string;

  @IsOptional()
  @IsString()
  SMTP_FROM_NAME?: string;

  /** `true` for implicit TLS (port 465); STARTTLS is used otherwise. */
  @IsOptional()
  @IsIn(['true', 'false'])
  SMTP_SECURE?: string;

  /** Public marketing origin used for links and the logo in emails. Falls back to WEB_URL. */
  @IsOptional()
  @IsUrl({ require_tld: false })
  APP_PUBLIC_URL?: string;

  @IsOptional()
  @IsEmail()
  SUPPORT_EMAIL?: string;

  /** Development only: write rendered emails to this directory instead of logging nothing. */
  @IsOptional()
  @IsString()
  EMAIL_PREVIEW_DIR?: string;

  @IsOptional()
  @IsString()
  EMAIL_DISPATCH_INTERVAL_MS?: string;

  /** Inbox told about new manual subscription payments. Defaults to ecomestabd@gmail.com. */
  @IsOptional()
  @IsEmail()
  BILLING_NOTIFICATION_EMAIL?: string;

  /** OAuth web client ID for "Continue with Google". Unset hides the button. */
  @IsOptional()
  @Matches(/^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$/, {
    message: 'GOOGLE_CLIENT_ID must look like 1234-abc.apps.googleusercontent.com',
  })
  GOOGLE_CLIENT_ID?: string;
}

/** Optional settings where an empty `KEY=` line in an env file means "not set". */
const EMPTY_MEANS_UNSET = [
  'EMAIL_PROVIDER_MODE',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASSWORD',
  'SMTP_FROM_EMAIL',
  'SMTP_FROM_NAME',
  'SMTP_SECURE',
  'APP_PUBLIC_URL',
  'SUPPORT_EMAIL',
  'EMAIL_PREVIEW_DIR',
  'EMAIL_DISPATCH_INTERVAL_MS',
  'GOOGLE_CLIENT_ID',
  'BILLING_NOTIFICATION_EMAIL',
];

export function validateEnv(rawConfig: Record<string, unknown>): EnvironmentVariables {
  const config = { ...rawConfig };
  for (const key of EMPTY_MEANS_UNSET) {
    if (typeof config[key] === 'string' && (config[key] as string).trim() === '') {
      delete config[key];
    }
  }
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validated, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    const messages = errors
      .map((error) => Object.values(error.constraints ?? {}).join(', '))
      .join('; ');
    throw new Error(`Environment validation failed: ${messages}`);
  }

  const isProduction = validated.NODE_ENV === NodeEnvironment.Production;

  if (isProduction) {
    if (validated.JWT_ACCESS_SECRET.length < 32) {
      throw new Error(
        'Environment validation failed: JWT_ACCESS_SECRET must be at least 32 characters in production',
      );
    }
    if (validated.JWT_REFRESH_SECRET.length < 32) {
      throw new Error(
        'Environment validation failed: JWT_REFRESH_SECRET must be at least 32 characters in production',
      );
    }

    const paymentKey = validated.PAYMENT_SECRETS_ENCRYPTION_KEY?.trim() ?? '';
    if (!paymentKey) {
      throw new Error(
        'Environment validation failed: PAYMENT_SECRETS_ENCRYPTION_KEY is required in production',
      );
    }
    const isHex64 = /^[0-9a-fA-F]{64}$/.test(paymentKey);
    if (!isHex64 && paymentKey.length < 32) {
      throw new Error(
        'Environment validation failed: PAYMENT_SECRETS_ENCRYPTION_KEY must be 64-char hex or at least 32 characters in production',
      );
    }

    assertProductionSafety(validated);
  }

  return validated;
}

const PLACEHOLDER_PATTERN =
  /change[-_]?me|replace[-_]?me|your[-_]|placeholder|example|dummy|sample|todo|xxxx/i;

const WEAK_PASSWORDS = new Set([
  'ecomesta',
  'postgres',
  'password',
  'redis',
  'admin',
  'root',
  'secret',
  'changeme',
  'test',
]);

const MIN_SERVICE_PASSWORD_LENGTH = 16;

function fail(message: string): never {
  throw new Error(`Environment validation failed: ${message}`);
}

/** True for values like "aaaa…" or "0123456789abcdef" repeated. */
function isRepetitive(value: string): boolean {
  if (new Set(value).size < 8) {
    return true;
  }
  for (let period = 1; period <= Math.floor(value.length / 2); period += 1) {
    if (value.length % period === 0 && value.slice(0, period).repeat(value.length / period) === value) {
      return true;
    }
  }
  return false;
}

function assertStrongSecret(name: string, value: string): void {
  if (PLACEHOLDER_PATTERN.test(value)) {
    fail(`${name} looks like a placeholder value; generate a random secret`);
  }
  if (isRepetitive(value)) {
    fail(`${name} is too predictable; generate a random secret`);
  }
}

function assertServicePassword(name: string, rawUrl: string, protocols: string[]): void {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    fail(`${name} is not a valid URL`);
  }
  if (!protocols.includes(url.protocol)) {
    fail(`${name} must use one of: ${protocols.join(', ')}`);
  }
  const password = decodeURIComponent(url.password);
  if (!password) {
    fail(`${name} must include a password in production`);
  }
  if (
    password.length < MIN_SERVICE_PASSWORD_LENGTH ||
    WEAK_PASSWORDS.has(password.toLowerCase()) ||
    PLACEHOLDER_PATTERN.test(password) ||
    isRepetitive(password)
  ) {
    fail(
      `${name} password is weak; use a random value of at least ${MIN_SERVICE_PASSWORD_LENGTH} characters`,
    );
  }
}

function isLocalHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  return (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host === '0.0.0.0' ||
    host === '::1' ||
    host.startsWith('127.')
  );
}

function assertPublicHttpsUrl(name: string, rawUrl: string): void {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    fail(`${name} is not a valid URL`);
  }
  if (url.protocol !== 'https:') {
    fail(`${name} must use https in production`);
  }
  if (isLocalHostname(url.hostname)) {
    fail(`${name} must not point at a local/development host in production`);
  }
}

function assertProductionSafety(env: EnvironmentVariables): void {
  assertStrongSecret('JWT_ACCESS_SECRET', env.JWT_ACCESS_SECRET);
  assertStrongSecret('JWT_REFRESH_SECRET', env.JWT_REFRESH_SECRET);
  if (env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) {
    fail('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different');
  }
  assertStrongSecret(
    'PAYMENT_SECRETS_ENCRYPTION_KEY',
    env.PAYMENT_SECRETS_ENCRYPTION_KEY?.trim() ?? '',
  );

  assertServicePassword('DATABASE_URL', env.DATABASE_URL, ['postgresql:', 'postgres:']);
  assertServicePassword('REDIS_URL', env.REDIS_URL, ['redis:', 'rediss:']);

  assertPublicHttpsUrl('API_URL', env.API_URL);
  assertPublicHttpsUrl('WEB_URL', env.WEB_URL);
  assertPublicHttpsUrl('MERCHANT_URL', env.MERCHANT_URL);
  assertPublicHttpsUrl('ADMIN_URL', env.ADMIN_URL);

  const corsOrigins = (env.CORS_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  for (const origin of corsOrigins) {
    if (origin === '*') {
      fail('CORS_ORIGINS must not contain "*" in production');
    }
    assertPublicHttpsUrl('CORS_ORIGINS', origin);
  }

  const rootDomain = env.PLATFORM_ROOT_DOMAIN?.trim() ?? '';
  if (!rootDomain) {
    fail('PLATFORM_ROOT_DOMAIN is required in production');
  }
  if (isLocalHostname(rootDomain) || !rootDomain.includes('.')) {
    fail('PLATFORM_ROOT_DOMAIN must be a public domain in production');
  }

  assertProductionEmail(env);
}

function assertProductionEmail(env: EnvironmentVariables): void {
  if (env.EMAIL_PROVIDER_MODE === 'console') {
    fail('EMAIL_PROVIDER_MODE=console is not allowed in production; use smtp or disabled');
  }
  if (env.EMAIL_PREVIEW_DIR?.trim()) {
    fail('EMAIL_PREVIEW_DIR must not be set in production');
  }
  if (env.EMAIL_PROVIDER_MODE !== 'smtp') {
    return;
  }
  const required = {
    SMTP_HOST: env.SMTP_HOST,
    SMTP_PORT: env.SMTP_PORT,
    SMTP_USER: env.SMTP_USER,
    SMTP_PASSWORD: env.SMTP_PASSWORD,
    SMTP_FROM_EMAIL: env.SMTP_FROM_EMAIL,
    SMTP_FROM_NAME: env.SMTP_FROM_NAME,
    SUPPORT_EMAIL: env.SUPPORT_EMAIL,
    APP_PUBLIC_URL: env.APP_PUBLIC_URL,
  };
  const missing = Object.entries(required)
    .filter(([, value]) => value === undefined || String(value).trim() === '')
    .map(([name]) => name);
  if (missing.length > 0) {
    fail(`EMAIL_PROVIDER_MODE=smtp requires ${missing.join(', ')}`);
  }
  if (PLACEHOLDER_PATTERN.test(env.SMTP_PASSWORD ?? '')) {
    fail('SMTP_PASSWORD looks like a placeholder value');
  }
  if (isLocalHostname(env.SMTP_HOST ?? '')) {
    fail('SMTP_HOST must not point at a local/development host in production');
  }
  assertPublicHttpsUrl('APP_PUBLIC_URL', env.APP_PUBLIC_URL ?? '');
}
