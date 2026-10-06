import { createHash } from 'crypto';
import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { AuthTokenPurpose, EmailDeliveryStatus } from '@prisma/client';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { EmailDispatcher } from '../src/modules/email/email-dispatcher.service';
import { EmailService } from '../src/modules/email/email.service';
import {
  EMAIL_PROVIDER,
  EmailSendError,
  type EmailMessage,
  type EmailProvider,
} from '../src/modules/email/providers/email-provider';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { activateOnboarded, withPayment } from './support/onboarding';

const GENERIC = 'If an account exists for that email, you will receive password reset instructions.';
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

class CapturingProvider implements EmailProvider {
  readonly name = 'capture';
  sent: EmailMessage[] = [];
  failures: EmailSendError[] = [];

  async sendEmail(message: EmailMessage) {
    const failure = this.failures.shift();
    if (failure) throw failure;
    this.sent.push(message);
    return { delivered: true, messageId: `<${this.sent.length}@test>` };
  }

  last(event: string, to?: string): EmailMessage | undefined {
    return [...this.sent].reverse().find((m) => m.event === event && (!to || m.to === to));
  }
}

function tokenFrom(message: EmailMessage | undefined, path: string): string {
  const match = new RegExp(`${path}#token=([A-Za-z0-9_-]+)`).exec(message?.text ?? '');
  if (!match?.[1]) throw new Error(`No ${path} token in email`);
  return match[1];
}

describe('Transactional email (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let email: EmailService;
  let dispatcher: EmailDispatcher;
  let redis: RedisService;
  const provider = new CapturingProvider();
  const unique = Date.now();
  const prefix = `txmail.${unique}`;
  const password = 'SecurePass1';
  const logLines: string[] = [];
  const originalSupport = process.env.SUPPORT_EMAIL;
  const tenantIds: string[] = [];

  const merchant = { email: `${prefix}.owner@example.com`, token: '', refresh: '', id: '' };
  const verifier = { email: `${prefix}.verify@example.com`, token: '', id: '' };

  async function clearRateLimits() {
    const client = redis.getClient();
    for (const pattern of ['auth:rl:forgot:*', 'auth:rl:reset:*', 'auth:rl:verify*', 'rl:support:*']) {
      const keys = await client.keys(pattern);
      if (keys.length) await client.del(...keys);
    }
  }

  /** Runs dispatcher passes until nothing is due (other suites may leave queued rows). */
  async function drain(now?: Date) {
    for (let i = 0; i < 100; i += 1) {
      if ((await dispatcher.processDue(now)) === 0) return;
    }
    throw new Error('Email outbox did not drain');
  }

  async function register(address: string, firstName: string) {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: address, password, firstName, lastName: 'Merchant' })
      .expect(201);
    return res.body.data as { accessToken: string; refreshToken: string; user: { id: string } };
  }

  beforeAll(async () => {
    process.env.SUPPORT_EMAIL = 'support@ecomesta.test';
    const record = (...args: unknown[]) => {
      logLines.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
    };
    jest.spyOn(Logger.prototype, 'log').mockImplementation(record);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(record);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(record);

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(EMAIL_PROVIDER)
      .useValue(provider)
      .compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();

    prisma = app.get(PrismaService);
    email = app.get(EmailService);
    dispatcher = app.get(EmailDispatcher);
    redis = app.get(RedisService);
    await clearRateLimits();
  });

  afterAll(async () => {
    await email.whenIdle();
    const users = await prisma.user.findMany({
      where: { email: { startsWith: prefix } },
      select: { id: true },
    });
    const userIds = users.map((u) => u.id);
    await prisma.emailDelivery.deleteMany({
      where: { OR: [{ userId: { in: userIds } }, { tenantId: { in: tenantIds } }] },
    });
    await prisma.auditLog.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.storeUser.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.tenantUser.deleteMany({ where: { userId: { in: userIds } } });
    if (tenantIds.length) {
      await prisma.subscription.deleteMany({ where: { tenantId: { in: tenantIds } } });
      await prisma.store.deleteMany({ where: { tenantId: { in: tenantIds } } });
      // Sign-up payments and the plan they started belong to the tenant.
      await prisma.billingPayment.deleteMany({ where: { tenantId: { in: tenantIds } } });
      await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } });
    }
    await prisma.authSession.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await clearRateLimits();
    await app.close();
    process.env.SUPPORT_EMAIL = originalSupport;
    jest.restoreAllMocks();
  });

  describe('registration', () => {
    it('creates the user and queues exactly one welcome email', async () => {
      const data = await register(merchant.email, 'Ada');
      merchant.token = data.accessToken;
      merchant.refresh = data.refreshToken;
      merchant.id = data.user.id;

      const rows = await prisma.emailDelivery.findMany({
        where: { userId: merchant.id, eventType: 'MERCHANT_WELCOME' },
      });
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        status: EmailDeliveryStatus.PENDING,
        idempotencyKey: `MERCHANT_WELCOME:${merchant.id}`,
        payload: { firstName: 'Ada' },
      });
      expect(JSON.stringify(rows[0])).not.toContain(password);
    });

    it('delivers the welcome email once, then clears the payload', async () => {
      await drain();
      await drain();

      const welcomes = provider.sent.filter((m) => m.event === 'MERCHANT_WELCOME' && m.to === merchant.email);
      expect(welcomes).toHaveLength(1);
      const welcome = welcomes[0]!;
      expect(welcome.subject).toBe('Welcome to Ecomesta');
      expect(welcome.html).toContain('Go to Your Dashboard');
      expect(welcome.html).not.toContain(password);

      const row = await prisma.emailDelivery.findFirstOrThrow({
        where: { userId: merchant.id, eventType: 'MERCHANT_WELCOME' },
      });
      expect(row).toMatchObject({
        status: EmailDeliveryStatus.SENT,
        attempts: 1,
        provider: 'capture',
        payload: null,
        recipientHash: sha256(merchant.email),
      });
      expect(JSON.stringify(row)).not.toContain(merchant.email);

      const verifyToken = tokenFrom(welcome, '/verify-email');
      const stored = await prisma.authToken.findMany({
        where: { userId: merchant.id, purpose: AuthTokenPurpose.EMAIL_VERIFICATION },
      });
      expect(stored).toHaveLength(1);
      expect(stored[0]!.tokenHash).toBe(sha256(verifyToken));
      expect(stored[0]!.tokenHash).not.toBe(verifyToken);
    });
  });

  describe('store creation', () => {
    let storeId = '';
    const suffix = String(unique).slice(-8);
    const onboardBody = {
      businessName: 'Txmail Tenant',
      tenantSlug: `txmail-tenant-${suffix}`,
      storeName: 'Txmail <Demo> Store',
      storeSlug: `txmail-store-${suffix}`,
    };

    it('queues a store-created email only after the store is committed', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/onboarding/store')
        .set('Authorization', `Bearer ${merchant.token}`)
        .send(withPayment(onboardBody))
        .expect(201).then(activateOnboarded(app));
      storeId = res.body.data.store.id;
      tenantIds.push(res.body.data.tenant.id);

      const rows = await prisma.emailDelivery.findMany({ where: { storeId, eventType: 'STORE_CREATED' } });
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        userId: merchant.id,
        tenantId: res.body.data.tenant.id,
        idempotencyKey: `STORE_CREATED:${storeId}`,
      });
    });

    it('does not duplicate the email when onboarding is retried or re-queued', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/onboarding/store')
        .set('Authorization', `Bearer ${merchant.token}`)
        .send(withPayment(onboardBody))
        .expect(409);
      const store = await prisma.store.findUniqueOrThrow({ where: { id: storeId } });
      await email.sendStoreCreated(
        { userId: merchant.id, tenantId: store.tenantId, storeId },
        { firstName: 'Ada', storeName: store.name, storeSlug: store.slug, planName: null, billingCycle: null, trialEndsAt: null },
      );
      expect(await prisma.emailDelivery.count({ where: { storeId, eventType: 'STORE_CREATED' } })).toBe(1);

      await drain();
      await drain();
      const sent = provider.sent.filter((m) => m.event === 'STORE_CREATED' && m.to === merchant.email);
      expect(sent).toHaveLength(1);
      // Created at sign-up together with the payment: live once the payment is confirmed.
      expect(sent[0]!.subject).toBe('Your store Txmail <Demo> Store has been created');
      expect(sent[0]!.text).toContain('goes live for customers as soon as it is confirmed');
      expect(sent[0]!.html).toContain('Txmail &lt;Demo&gt; Store');
      expect(sent[0]!.text).toContain(`?store=${onboardBody.storeSlug}`);
      expect(sent[0]!.text).toContain('/dashboard');
    });

    it('retries transient delivery failures with backoff and gives up on permanent ones', async () => {
      await drain();
      await prisma.emailDelivery.create({
        data: {
          eventType: 'STORE_CREATED',
          userId: merchant.id,
          storeId,
          idempotencyKey: `test-retry:${unique}`,
          payload: { firstName: 'Ada', storeName: 'Retry', storeSlug: onboardBody.storeSlug, planName: null, billingCycle: null, trialEndsAt: null },
        },
      });
      provider.failures.push(new EmailSendError('connection', false));
      await drain();
      let row = await prisma.emailDelivery.findUniqueOrThrow({ where: { idempotencyKey: `test-retry:${unique}` } });
      expect(row.status).toBe(EmailDeliveryStatus.FAILED);
      expect(row.errorCategory).toBe('connection');
      expect(row.nextAttemptAt!.getTime()).toBeGreaterThan(Date.now());
      expect(row.payload).not.toBeNull();

      await drain(new Date(Date.now() + 2 * 60 * 1000));
      row = await prisma.emailDelivery.findUniqueOrThrow({ where: { id: row.id } });
      expect(row).toMatchObject({ status: EmailDeliveryStatus.SENT, attempts: 2, payload: null });

      await prisma.emailDelivery.create({
        data: {
          eventType: 'STORE_CREATED',
          userId: merchant.id,
          storeId,
          idempotencyKey: `test-permanent:${unique}`,
          payload: { firstName: 'Ada', storeName: 'Nope', storeSlug: onboardBody.storeSlug, planName: null, billingCycle: null, trialEndsAt: null },
        },
      });
      provider.failures.push(new EmailSendError('rejected', true));
      await drain();
      row = await prisma.emailDelivery.findUniqueOrThrow({ where: { idempotencyKey: `test-permanent:${unique}` } });
      expect(row).toMatchObject({
        status: EmailDeliveryStatus.FAILED,
        errorCategory: 'rejected',
        nextAttemptAt: null,
        payload: null,
      });
    });
  });

  describe('forgot password', () => {
    let firstToken = '';

    it('returns the same generic response for existing and unknown accounts', async () => {
      await clearRateLimits();
      const before = provider.sent.length;
      const known = await request(app.getHttpServer())
        .post('/api/v1/auth/forgot-password')
        .send({ email: merchant.email.toUpperCase() })
        .expect(200);
      const unknown = await request(app.getHttpServer())
        .post('/api/v1/auth/forgot-password')
        .send({ email: `${prefix}.nobody@example.com` })
        .expect(200);
      expect(known.body).toEqual({ success: true, data: { message: GENERIC } });
      expect(unknown.body).toEqual(known.body);

      await email.whenIdle();
      const sent = provider.sent.slice(before);
      expect(sent).toHaveLength(1);
      expect(sent[0]!.to).toBe(merchant.email);
      expect(sent[0]!.subject).toBe('Reset your Ecomesta password');
      firstToken = tokenFrom(sent[0], '/reset-password');
    });

    it('stores only a hash of the reset token, with a one-hour expiry', async () => {
      const tokens = await prisma.authToken.findMany({
        where: { userId: merchant.id, purpose: AuthTokenPurpose.PASSWORD_RESET },
      });
      expect(tokens).toHaveLength(1);
      expect(tokens[0]!.tokenHash).toBe(sha256(firstToken));
      expect(tokens[0]!.usedAt).toBeNull();
      const ttl = tokens[0]!.expiresAt.getTime() - tokens[0]!.createdAt.getTime();
      expect(ttl).toBeGreaterThan(59 * 60 * 1000);
      expect(ttl).toBeLessThanOrEqual(60 * 60 * 1000 + 5000);
      const log = await prisma.emailDelivery.findFirstOrThrow({
        where: { userId: merchant.id, eventType: 'PASSWORD_RESET' },
        orderBy: { createdAt: 'desc' },
      });
      expect(log).toMatchObject({ status: EmailDeliveryStatus.SENT, payload: null });
      expect(JSON.stringify(log)).not.toContain(firstToken);
    });

    it('invalidates the previous unused token when a new one is requested', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/forgot-password')
        .send({ email: merchant.email })
        .expect(200);
      await email.whenIdle();
      await request(app.getHttpServer())
        .post('/api/v1/auth/reset-password/validate')
        .send({ token: firstToken })
        .expect(400);
    });

    it('rate limits repeated requests', async () => {
      await clearRateLimits();
      for (let i = 0; i < 5; i += 1) {
        await request(app.getHttpServer())
          .post('/api/v1/auth/forgot-password')
          .send({ email: `${prefix}.flood@example.com` })
          .expect(200);
      }
      const limited = await request(app.getHttpServer())
        .post('/api/v1/auth/forgot-password')
        .send({ email: `${prefix}.flood@example.com` })
        .expect(429);
      expect(limited.body.error.code).toBe('TOO_MANY_REQUESTS');
      await clearRateLimits();
    });
  });

  describe('reset password', () => {
    let token = '';

    beforeAll(async () => {
      await clearRateLimits();
      await request(app.getHttpServer())
        .post('/api/v1/auth/forgot-password')
        .send({ email: merchant.email })
        .expect(200);
      await email.whenIdle();
      token = tokenFrom(provider.last('PASSWORD_RESET', merchant.email), '/reset-password');
    });

    it('validates tokens without consuming them', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/reset-password/validate')
        .send({ token })
        .expect(200);
      expect(res.body.data.valid).toBe(true);
      const invalid = await request(app.getHttpServer())
        .post('/api/v1/auth/reset-password/validate')
        .send({ token: 'A'.repeat(43) })
        .expect(400);
      expect(invalid.body.error.code).toBe('RESET_TOKEN_INVALID');
    });

    it('rejects expired tokens', async () => {
      const row = await prisma.authToken.findUniqueOrThrow({ where: { tokenHash: sha256(token) } });
      await prisma.authToken.update({ where: { id: row.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/reset-password')
        .send({ token, password: 'BrandNewPass2' })
        .expect(400);
      expect(res.body.error.code).toBe('RESET_TOKEN_EXPIRED');
      await prisma.authToken.update({ where: { id: row.id }, data: { expiresAt: new Date(Date.now() + 30 * 60 * 1000) } });
    });

    it('enforces the password policy', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/reset-password')
        .send({ token, password: 'short' })
        .expect(400);
    });

    it('resets the password, revokes every session and audits the change', async () => {
      const oldHash = (await prisma.user.findUniqueOrThrow({ where: { id: merchant.id } })).passwordHash;
      await request(app.getHttpServer())
        .post('/api/v1/auth/reset-password')
        .send({ token, password: 'BrandNewPass2' })
        .expect(200);

      const user = await prisma.user.findUniqueOrThrow({ where: { id: merchant.id } });
      expect(user.passwordHash).not.toBe(oldHash);
      expect(user.passwordHash.startsWith('$argon2id$')).toBe(true);
      expect(user.emailVerifiedAt).not.toBeNull();
      expect(await prisma.authSession.count({ where: { userId: merchant.id, revokedAt: null } })).toBe(0);

      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: merchant.refresh })
        .expect(401);
      await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${merchant.token}`)
        .expect(401);
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: merchant.email, password })
        .expect(401);
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: merchant.email, password: 'BrandNewPass2' })
        .expect(200);

      const audit = await prisma.auditLog.findFirst({
        where: { userId: merchant.id, action: 'PASSWORD_RESET_COMPLETED' },
      });
      expect(audit).not.toBeNull();
      expect(JSON.stringify(audit)).not.toContain(token);
    });

    it('rejects a reused token', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/reset-password')
        .send({ token, password: 'AnotherPass3' })
        .expect(400);
      expect(res.body.error.code).toBe('RESET_TOKEN_USED');
    });

    it('sends one password-changed email', async () => {
      await drain();
      await drain();
      const changed = provider.sent.filter((m) => m.event === 'PASSWORD_CHANGED' && m.to === merchant.email);
      expect(changed).toHaveLength(1);
      expect(changed[0]!.subject).toBe('Your Ecomesta password was changed');
      expect(changed[0]!.html).not.toContain('BrandNewPass2');
    });
  });

  describe('email verification', () => {
    it('sends a verification link and confirms it once', async () => {
      await clearRateLimits();
      const data = await register(verifier.email, 'Grace');
      verifier.token = data.accessToken;
      verifier.id = data.user.id;

      const me = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${verifier.token}`)
        .expect(200);
      expect(me.body.data.emailVerified).toBe(false);

      const sent = await request(app.getHttpServer())
        .post('/api/v1/auth/email-verification/send')
        .set('Authorization', `Bearer ${verifier.token}`)
        .expect(200);
      expect(sent.body.data.sent).toBe(true);
      await email.whenIdle();
      const token = tokenFrom(provider.last('EMAIL_VERIFICATION', verifier.email), '/verify-email');

      await request(app.getHttpServer())
        .post('/api/v1/auth/email-verification/confirm')
        .send({ token })
        .expect(200);
      const after = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${verifier.token}`)
        .expect(200);
      expect(after.body.data.emailVerified).toBe(true);

      const reused = await request(app.getHttpServer())
        .post('/api/v1/auth/email-verification/confirm')
        .send({ token })
        .expect(400);
      expect(reused.body.error.code).toBe('VERIFICATION_TOKEN_USED');
    });

    it('rate limits verification emails', async () => {
      await clearRateLimits();
      await prisma.user.update({ where: { id: verifier.id }, data: { emailVerifiedAt: null } });
      for (let i = 0; i < 5; i += 1) {
        await request(app.getHttpServer())
          .post('/api/v1/auth/email-verification/send')
          .set('Authorization', `Bearer ${verifier.token}`)
          .expect(200);
      }
      await request(app.getHttpServer())
        .post('/api/v1/auth/email-verification/send')
        .set('Authorization', `Bearer ${verifier.token}`)
        .expect(429);
      await email.whenIdle();
      await clearRateLimits();
    });
  });

  describe('support requests', () => {
    it('exposes the configured support address', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/support/contact').expect(200);
      expect(res.body.data).toEqual({ supportEmail: 'support@ecomesta.test', requestsEnabled: true });
    });

    it('queues one email to support with the merchant as reply-to, even if resubmitted', async () => {
      const requestId = '7f0c2b8e-4a39-4d6b-9a8e-2f1c3d4e5f60';
      const body = {
        category: 'Billing',
        subject: 'Question about my plan',
        message: 'Hello team, I have a question about billing.',
        requestId,
      };
      for (let i = 0; i < 2; i += 1) {
        await request(app.getHttpServer())
          .post('/api/v1/support/requests')
          .set('Authorization', `Bearer ${verifier.token}`)
          .send(body)
          .expect(201);
      }
      expect(
        await prisma.emailDelivery.count({ where: { userId: verifier.id, eventType: 'SUPPORT_REQUEST' } }),
      ).toBe(1);

      await drain();
      const message = provider.last('SUPPORT_REQUEST');
      expect(message).toMatchObject({
        to: 'support@ecomesta.test',
        replyTo: verifier.email,
        subject: '[Support] Billing: Question about my plan',
      });
    });

    it('requires authentication and rejects invalid input', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/support/requests')
        .send({ category: 'Billing', subject: 'Hi', message: 'short' })
        .expect(401);
      await request(app.getHttpServer())
        .post('/api/v1/support/requests')
        .set('Authorization', `Bearer ${verifier.token}`)
        .send({ category: 'Nope', subject: 'Hi', message: 'short' })
        .expect(400);
    });
  });

  describe('security', () => {
    it('never stores raw tokens or keeps payloads for finished deliveries', async () => {
      const userIds = [merchant.id, verifier.id];
      const rows = await prisma.emailDelivery.findMany({
        where: { userId: { in: userIds }, status: { in: [EmailDeliveryStatus.SENT, EmailDeliveryStatus.SKIPPED] } },
      });
      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows) expect(row.payload).toBeNull();

      const rawTokens = provider.sent
        .map((m) => /#token=([A-Za-z0-9_-]+)/.exec(m.text)?.[1])
        .filter((t): t is string => Boolean(t));
      expect(rawTokens.length).toBeGreaterThan(2);
      const stored = await prisma.authToken.findMany({ where: { userId: { in: userIds } } });
      const storedValues = JSON.stringify(stored);
      const deliveries = JSON.stringify(await prisma.emailDelivery.findMany({ where: { userId: { in: userIds } } }));
      const audits = JSON.stringify(await prisma.auditLog.findMany({ where: { userId: { in: userIds } } }));
      for (const raw of rawTokens) {
        expect(storedValues).not.toContain(raw);
        expect(deliveries).not.toContain(raw);
        expect(audits).not.toContain(raw);
      }
    });

    it('never writes tokens or passwords to application logs', () => {
      const output = logLines.join('\n');
      const rawTokens = provider.sent
        .map((m) => /#token=([A-Za-z0-9_-]+)/.exec(m.text)?.[1])
        .filter((t): t is string => Boolean(t));
      for (const raw of rawTokens) expect(output).not.toContain(raw);
      expect(output).not.toContain('BrandNewPass2');
      expect(output).not.toContain(password);
    });

    it('never puts passwords in any email', () => {
      for (const message of provider.sent) {
        expect(message.html).not.toContain(password);
        expect(message.html).not.toContain('BrandNewPass2');
        expect(message.text).not.toContain(password);
      }
    });
  });
});
