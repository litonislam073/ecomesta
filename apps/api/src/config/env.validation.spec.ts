import 'reflect-metadata';
import { validateEnv } from './env.validation';

describe('validateEnv production gates', () => {
  const dbPassword = 'Qm7vK2pX9sLw4TzR8nYc';
  const redisPassword = 'h3Jd8Kq2Lm5Nv7Pw1Rt9';
  const base = {
    NODE_ENV: 'production',
    DATABASE_URL: `postgresql://ecomesta:${dbPassword}@postgres:5432/ecomesta?schema=public`,
    REDIS_URL: `redis://:${redisPassword}@redis:6379`,
    JWT_ACCESS_SECRET: 'a8F3kL9qZ2mX7vB4nR6tY1wP5sD0gH3jK8cV2bN7',
    JWT_REFRESH_SECRET: 'Z9x8C7v6B5n4M3a2S1d0F9g8H7j6K5l4P3o2I1u0',
    API_PORT: 3001,
    API_URL: 'https://api.ecomesta.com',
    WEB_URL: 'https://ecomesta.com',
    MERCHANT_URL: 'https://merchant.ecomesta.com',
    ADMIN_URL: 'https://admin.ecomesta.com',
    CORS_ORIGINS: 'https://ecomesta.com,https://merchant.ecomesta.com',
    PLATFORM_ROOT_DOMAIN: 'ecomesta.com',
    PAYMENT_SECRETS_ENCRYPTION_KEY:
      '9f2c4e7a1b8d3f6a0c5e9b2d7f4a1c8e3b6d9f2a5c8e1b4d7f0a3c6e9b2d5f8a',
  };

  const messageFor = (overrides: Record<string, unknown>): string => {
    try {
      validateEnv({ ...base, ...overrides });
    } catch (error) {
      return (error as Error).message;
    }
    return '';
  };

  it('accepts a valid production config', () => {
    expect(() => validateEnv(base)).not.toThrow();
  });

  it('does not apply production gates outside production', () => {
    expect(() =>
      validateEnv({
        ...base,
        NODE_ENV: 'development',
        DATABASE_URL: 'postgresql://ecomesta:ecomesta@localhost:5432/ecomesta',
        REDIS_URL: 'redis://localhost:6379',
        API_URL: 'http://localhost:3001',
        PLATFORM_ROOT_DOMAIN: undefined,
      }),
    ).not.toThrow();
  });

  it('rejects short JWT secrets in production', () => {
    expect(() =>
      validateEnv({ ...base, JWT_ACCESS_SECRET: 'too-short' }),
    ).toThrow(/JWT_ACCESS_SECRET/);
  });

  it('requires PAYMENT_SECRETS_ENCRYPTION_KEY in production', () => {
    const { PAYMENT_SECRETS_ENCRYPTION_KEY: _, ...rest } = base;
    expect(() => validateEnv(rest)).toThrow(/PAYMENT_SECRETS_ENCRYPTION_KEY/);
  });

  it.each([
    ['JWT_ACCESS_SECRET', 'CHANGE_ME_generate_with_openssl_rand_hex_32_chars'],
    ['JWT_REFRESH_SECRET', 'x'.repeat(48)],
    ['PAYMENT_SECRETS_ENCRYPTION_KEY', '0123456789abcdef'.repeat(4)],
    ['PAYMENT_SECRETS_ENCRYPTION_KEY', 'replace-me-with-a-real-32-byte-key-please'],
  ])('rejects placeholder or predictable %s', (name, value) => {
    const message = messageFor({ [name]: value });
    expect(message).toMatch(new RegExp(name));
    expect(message).not.toContain(value);
  });

  it('rejects identical access and refresh secrets', () => {
    expect(messageFor({ JWT_REFRESH_SECRET: base.JWT_ACCESS_SECRET })).toMatch(
      /must be different/,
    );
  });

  it.each([
    ['missing password', 'postgresql://ecomesta@postgres:5432/ecomesta'],
    ['default password', 'postgresql://ecomesta:ecomesta@postgres:5432/ecomesta'],
    ['short password', 'postgresql://ecomesta:Ab3dE6gH@postgres:5432/ecomesta'],
    ['placeholder password', 'postgresql://ecomesta:CHANGE_ME_STRONG_PASS@postgres:5432/ecomesta'],
  ])('rejects DATABASE_URL with %s without echoing it', (_label, url) => {
    const message = messageFor({ DATABASE_URL: url });
    expect(message).toMatch(/DATABASE_URL/);
    expect(message).not.toContain(url);
    expect(message).not.toMatch(/ecomesta:|CHANGE_ME|Ab3dE6gH/);
  });

  it('requires Redis authentication in production', () => {
    expect(messageFor({ REDIS_URL: 'redis://redis:6379' })).toMatch(
      /REDIS_URL must include a password/,
    );
    expect(messageFor({ REDIS_URL: 'redis://:redis@redis:6379' })).toMatch(
      /REDIS_URL password is weak/,
    );
  });

  it('rejects localhost and plain-http public URLs in production', () => {
    expect(messageFor({ API_URL: 'http://api.ecomesta.com' })).toMatch(
      /API_URL must use https/,
    );
    expect(messageFor({ WEB_URL: 'https://localhost:3000' })).toMatch(/WEB_URL/);
    expect(messageFor({ MERCHANT_URL: 'https://merchant.ecomesta.local' })).toMatch(
      /MERCHANT_URL/,
    );
    expect(messageFor({ ADMIN_URL: 'https://127.0.0.1:3003' })).toMatch(/ADMIN_URL/);
  });

  it('rejects wildcard or local CORS origins in production', () => {
    expect(messageFor({ CORS_ORIGINS: '*' })).toMatch(/CORS_ORIGINS/);
    expect(
      messageFor({ CORS_ORIGINS: 'https://ecomesta.com,http://localhost:3000' }),
    ).toMatch(/CORS_ORIGINS/);
  });

  it('requires a public PLATFORM_ROOT_DOMAIN in production', () => {
    expect(messageFor({ PLATFORM_ROOT_DOMAIN: undefined })).toMatch(
      /PLATFORM_ROOT_DOMAIN is required/,
    );
    expect(messageFor({ PLATFORM_ROOT_DOMAIN: 'ecomesta.local' })).toMatch(
      /PLATFORM_ROOT_DOMAIN must be a public domain/,
    );
  });

  describe('email', () => {
    const smtp = {
      EMAIL_PROVIDER_MODE: 'smtp',
      SMTP_HOST: 'smtp.mailprovider.net',
      SMTP_PORT: '587',
      SMTP_USER: 'ecomesta-mailer',
      SMTP_PASSWORD: 'kP9vT2mQ7xL4sN8wR3zB',
      SMTP_FROM_EMAIL: 'no-reply@ecomesta.com',
      SMTP_FROM_NAME: 'Ecomesta',
      SMTP_SECURE: 'false',
      SUPPORT_EMAIL: 'support@ecomesta.com',
      APP_PUBLIC_URL: 'https://ecomesta.com',
    };

    it('starts without any email settings (delivery disabled)', () => {
      expect(messageFor({})).toBe('');
    });

    it('treats empty email variables as unset', () => {
      expect(
        messageFor({ EMAIL_PROVIDER_MODE: '', SMTP_PORT: '', SMTP_FROM_EMAIL: '', APP_PUBLIC_URL: '' }),
      ).toBe('');
    });

    it('accepts a complete SMTP configuration', () => {
      expect(messageFor(smtp)).toBe('');
    });

    it('requires every SMTP setting when EMAIL_PROVIDER_MODE=smtp', () => {
      for (const key of [
        'SMTP_HOST',
        'SMTP_PORT',
        'SMTP_USER',
        'SMTP_PASSWORD',
        'SMTP_FROM_EMAIL',
        'SMTP_FROM_NAME',
        'SUPPORT_EMAIL',
        'APP_PUBLIC_URL',
      ]) {
        expect(messageFor({ ...smtp, [key]: undefined })).toMatch(new RegExp(key));
      }
    });

    it('rejects placeholder SMTP passwords, local hosts and http public URLs', () => {
      expect(messageFor({ ...smtp, SMTP_PASSWORD: 'CHANGE_ME' })).toMatch(/SMTP_PASSWORD/);
      expect(messageFor({ ...smtp, SMTP_HOST: 'localhost' })).toMatch(/SMTP_HOST/);
      expect(messageFor({ ...smtp, APP_PUBLIC_URL: 'http://ecomesta.com' })).toMatch(/APP_PUBLIC_URL/);
    });

    it('rejects console mode and preview directories in production', () => {
      expect(messageFor({ EMAIL_PROVIDER_MODE: 'console' })).toMatch(/console is not allowed/);
      expect(messageFor({ EMAIL_PREVIEW_DIR: '/tmp/mail' })).toMatch(/EMAIL_PREVIEW_DIR/);
    });

    it('rejects unknown modes and malformed addresses', () => {
      expect(messageFor({ EMAIL_PROVIDER_MODE: 'sendmail' })).not.toBe('');
      expect(messageFor({ ...smtp, SUPPORT_EMAIL: 'not-an-email' })).not.toBe('');
    });

    it('does not print SMTP secrets in validation errors', () => {
      const message = messageFor({ ...smtp, SMTP_FROM_NAME: undefined });
      expect(message).not.toContain(smtp.SMTP_PASSWORD);
      expect(message).not.toContain(smtp.SMTP_USER);
    });
  });

  describe('AI_SUPPORT_RETENTION_DAYS', () => {
    it('is optional, and an empty value means the default', () => {
      expect(validateEnv(base).AI_SUPPORT_RETENTION_DAYS).toBeUndefined();
      expect(validateEnv({ ...base, AI_SUPPORT_RETENTION_DAYS: '' }).AI_SUPPORT_RETENTION_DAYS).toBeUndefined();
    });

    it('accepts whole days from 1 to 3650', () => {
      expect(validateEnv({ ...base, AI_SUPPORT_RETENTION_DAYS: '30' }).AI_SUPPORT_RETENTION_DAYS).toBe(30);
      expect(validateEnv({ ...base, AI_SUPPORT_RETENTION_DAYS: '3650' }).AI_SUPPORT_RETENTION_DAYS).toBe(3650);
    });

    it('rejects zero, fractions, text and more than ten years', () => {
      for (const value of ['0', '-5', '1.5', 'abc', '3651']) {
        expect(messageFor({ AI_SUPPORT_RETENTION_DAYS: value })).toMatch(/AI_SUPPORT_RETENTION_DAYS/);
      }
    });
  });
});
