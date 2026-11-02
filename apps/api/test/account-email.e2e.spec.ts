import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { PlatformRole } from '@prisma/client';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { EmailService } from '../src/modules/email/email.service';
import { EMAIL_PROVIDER, type EmailMessage, type EmailProvider } from '../src/modules/email/providers/email-provider';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';

class CapturingProvider implements EmailProvider {
  readonly name = 'capture';
  sent: EmailMessage[] = [];
  async sendEmail(message: EmailMessage) {
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

describe('Account email change (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let email: EmailService;
  let redis: RedisService;
  const provider = new CapturingProvider();
  const prefix = `acctmail.${Date.now()}`;
  const password = 'SecurePass1';
  const userIds: string[] = [];

  const http = () => request(app.getHttpServer());

  async function register(address: string) {
    const res = await http()
      .post('/api/v1/auth/register')
      .send({ email: address, password, firstName: 'Rahim', lastName: 'Merchant' })
      .expect(201);
    userIds.push(res.body.data.user.id);
    return res.body.data as { accessToken: string; user: { id: string } };
  }

  async function clearRateLimits() {
    const client = redis.getClient();
    for (const pattern of ['auth:rl:email-change*', 'auth:rl:register*', 'auth:rl:login*', 'auth:rl:verify*']) {
      const keys = await client.keys(pattern);
      if (keys.length) await client.del(...keys);
    }
  }

  beforeAll(async () => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
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
    redis = app.get(RedisService);
    await clearRateLimits();
  });

  afterAll(async () => {
    await email.whenIdle();
    await prisma.emailDelivery.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.auditLog.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.authToken.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.authSession.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await clearRateLimits();
    await app.close();
  });

  it('lets a merchant fix a mistyped email through a link sent to the new address', async () => {
    const typo = `${prefix}.rahim@gmial.com`;
    const correct = `${prefix}.rahim@gmail.com`;
    const owner = await register(typo);
    const auth = { Authorization: `Bearer ${owner.accessToken}` };

    await http()
      .post('/api/v1/auth/email-change')
      .set(auth)
      .send({ email: correct, currentPassword: 'WrongPass1' })
      .expect(400)
      .expect((res) => expect(res.body.error.code ?? res.body.error).toBeDefined());
    expect((await prisma.user.findUniqueOrThrow({ where: { id: owner.user.id } })).pendingEmail).toBeNull();

    const requested = await http()
      .post('/api/v1/auth/email-change')
      .set(auth)
      .send({ email: ` ${correct.toUpperCase()} `, currentPassword: password })
      .expect(200);
    expect(requested.body.data).toEqual({ pendingEmail: correct, expiresInHours: 24 });

    // Until the link is opened the account keeps signing in with the old address.
    const me = await http().get('/api/v1/auth/me').set(auth).expect(200);
    expect(me.body.data).toMatchObject({ email: typo, pendingEmail: correct });

    await email.whenIdle();
    const confirmation = provider.last('EMAIL_CHANGE_CONFIRMATION', correct);
    const heads = provider.last('EMAIL_CHANGE_REQUESTED', typo);
    expect(confirmation?.subject).toBe('Confirm your new Ecomesta email address');
    expect(heads?.text).not.toContain(correct);
    expect(heads?.text).toContain(`${prefix.slice(0, 2)}***@gmail.com`);

    const token = tokenFrom(confirmation, '/confirm-email-change');
    const confirmed = await http().post('/api/v1/auth/email-change/confirm').send({ token }).expect(200);
    expect(confirmed.body.data).toEqual({ email: correct });

    const user = await prisma.user.findUniqueOrThrow({ where: { id: owner.user.id } });
    expect(user.email).toBe(correct);
    expect(user.pendingEmail).toBeNull();
    expect(user.emailVerifiedAt).not.toBeNull();

    // The link works once, and the new address now signs in.
    await http().post('/api/v1/auth/email-change/confirm').send({ token }).expect(400);
    await http().post('/api/v1/auth/login').send({ email: correct, password }).expect(200);
    await http().post('/api/v1/auth/login').send({ email: typo, password }).expect(401);
  });

  it('refuses an address another account uses, and lets a merchant cancel', async () => {
    const owner = await register(`${prefix}.owner2@example.com`);
    const other = `${prefix}.taken@example.com`;
    await register(other);
    const auth = { Authorization: `Bearer ${owner.accessToken}` };

    await http()
      .post('/api/v1/auth/email-change')
      .set(auth)
      .send({ email: other, currentPassword: password })
      .expect(409);

    const target = `${prefix}.next@example.com`;
    await http().post('/api/v1/auth/email-change').set(auth).send({ email: target, currentPassword: password }).expect(200);
    await email.whenIdle();
    const token = tokenFrom(provider.last('EMAIL_CHANGE_CONFIRMATION', target), '/confirm-email-change');

    await http().post('/api/v1/auth/email-change/cancel').set(auth).expect(200);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: owner.user.id } })).pendingEmail).toBeNull();
    // A cancelled change cannot be completed with the old link.
    await http().post('/api/v1/auth/email-change/confirm').send({ token }).expect(400);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: owner.user.id } })).email).toBe(
      `${prefix}.owner2@example.com`,
    );
  });

  it('lets a Super Admin set a user email, which then needs confirming', async () => {
    const admin = await register(`${prefix}.admin@example.com`);
    await prisma.user.update({ where: { id: admin.user.id }, data: { platformRole: PlatformRole.SUPER_ADMIN } });
    const merchant = await register(`${prefix}.shop@gmial.com`);
    const fixed = `${prefix}.shop@gmail.com`;
    const adminAuth = { Authorization: `Bearer ${admin.accessToken}` };

    // Ordinary users cannot use the admin route.
    await http()
      .patch(`/api/v1/admin/users/${admin.user.id}/email`)
      .set({ Authorization: `Bearer ${merchant.accessToken}` })
      .send({ email: `${prefix}.hijack@example.com` })
      .expect(403);

    const res = await http()
      .patch(`/api/v1/admin/users/${merchant.user.id}/email`)
      .set(adminAuth)
      .send({ email: fixed })
      .expect(200);
    expect(res.body.data).toMatchObject({ email: fixed, emailVerifiedAt: null, pendingEmail: null });

    await http()
      .patch(`/api/v1/admin/users/${merchant.user.id}/email`)
      .set(adminAuth)
      .send({ email: `${prefix}.admin@example.com` })
      .expect(409);

    await email.whenIdle();
    const verify = provider.last('EMAIL_VERIFICATION', fixed);
    expect(verify).toBeDefined();
    expect(provider.sent.some((m) => m.to === `${prefix}.shop@gmial.com` && m.event === 'EMAIL_VERIFICATION')).toBe(false);
    await http()
      .post('/api/v1/auth/email-verification/confirm')
      .send({ token: tokenFrom(verify, '/verify-email') })
      .expect(200);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: merchant.user.id } })).emailVerifiedAt).not.toBeNull();

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'USER_EMAIL_CHANGED_BY_ADMIN', entityId: merchant.user.id },
    });
    expect(audit?.userId).toBe(admin.user.id);
    expect(audit?.metadata).toMatchObject({ previousEmail: `${prefix}.shop@gmial.com`, email: fixed });
  });
});
