import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
  validateSync,
} from 'class-validator';

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
}

export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
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
}
