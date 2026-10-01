import { ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { UserStatus } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import {
  GoogleIdTokenVerifier,
  type GoogleIdentity,
} from '../src/modules/auth/google-id-token.verifier';
import { PrismaService } from '../src/prisma/prisma.service';

/** Maps fake credentials to identities so no real Google token is needed. */
class FakeGoogleVerifier {
  enabled = true;
  readonly identities = new Map<string, GoogleIdentity>();

  clientId(): string | null {
    return this.enabled ? '1234-test.apps.googleusercontent.com' : null;
  }

  async verify(credential: string): Promise<GoogleIdentity | null> {
    return this.identities.get(credential) ?? null;
  }
}

describe('Sign in with Google (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  const google = new FakeGoogleVerifier();
  const unique = Date.now();
  const marker = `google.user.${unique}`;
  const newEmail = `${marker}.new@example.com`;
  const existingEmail = `${marker}.existing@example.com`;

  function identity(overrides: Partial<GoogleIdentity>): GoogleIdentity {
    return {
      sub: `sub-${unique}-${Math.random()}`,
      email: newEmail,
      emailVerified: true,
      givenName: 'Gia',
      familyName: 'Google',
      picture: null,
      ...overrides,
    };
  }

  function credential(id: GoogleIdentity): string {
    const token = `fake-credential-${id.sub}`;
    google.identities.set(token, id);
    return token;
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(GoogleIdTokenVerifier)
      .useValue(google)
      .compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    const where = { email: { contains: marker } };
    await prisma.authSession.deleteMany({ where: { user: where } });
    await prisma.emailDelivery.deleteMany({ where: { user: where } });
    await prisma.authToken.deleteMany({ where: { user: where } });
    await prisma.user.deleteMany({ where });
    await app.close();
  });

  afterEach(() => {
    google.enabled = true;
  });

  it('advertises the Google client ID', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/auth/providers').expect(200);
    expect(res.body.data.google).toEqual({ clientId: '1234-test.apps.googleusercontent.com' });
  });

  it('hides Google when no client ID is configured', async () => {
    google.enabled = false;
    const res = await request(app.getHttpServer()).get('/api/v1/auth/providers').expect(200);
    expect(res.body.data.google).toBeNull();
    await request(app.getHttpServer())
      .post('/api/v1/auth/google')
      .send({ credential: 'fake-credential-disabled-000' })
      .expect(503);
  });

  it('registers a new verified account on first Google sign-in', async () => {
    const id = identity({ email: newEmail.toUpperCase() });
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/google')
      .send({ credential: credential(id) })
      .expect(200);

    expect(res.body.data.created).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.user.email).toBe(newEmail);
    expect(res.body.data.user.emailVerified).toBe(true);
    expect(res.body.data.user.firstName).toBe('Gia');
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|googleSub/);

    const user = await prisma.user.findUniqueOrThrow({ where: { email: newEmail } });
    expect(user.googleSub).toBe(id.sub);

    const again = await request(app.getHttpServer())
      .post('/api/v1/auth/google')
      .send({ credential: credential(id) })
      .expect(200);
    expect(again.body.data.created).toBe(false);
    expect(again.body.data.user.id).toBe(user.id);
  });

  it('links Google to an existing password account with the same email', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: existingEmail, password: 'SecurePass1', firstName: 'Pre', lastName: 'Existing' })
      .expect(201);

    const id = identity({ email: existingEmail });
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/google')
      .send({ credential: credential(id) })
      .expect(200);

    expect(res.body.data.created).toBe(false);
    expect(res.body.data.user.firstName).toBe('Pre');
    expect(res.body.data.user.emailVerified).toBe(true);

    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: existingEmail, password: 'SecurePass1' })
      .expect(200);
  });

  it('rejects a different Google account for an already linked email', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/google')
      .send({ credential: credential(identity({ email: existingEmail })) })
      .expect(409);
    expect(res.body.error.message).toMatch(/different Google account/);
  });

  it('rejects unverified Google emails and invalid tokens', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/google')
      .send({ credential: credential(identity({ email: `${marker}.unverified@example.com`, emailVerified: false })) })
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/v1/auth/google')
      .send({ credential: 'fake-credential-unknown-0000' })
      .expect(401);
    await request(app.getHttpServer()).post('/api/v1/auth/google').send({}).expect(400);
    expect(await prisma.user.count({ where: { email: `${marker}.unverified@example.com` } })).toBe(0);
  });

  it('blocks suspended accounts', async () => {
    await prisma.user.update({ where: { email: newEmail }, data: { status: UserStatus.SUSPENDED } });
    const user = await prisma.user.findUniqueOrThrow({ where: { email: newEmail } });
    await request(app.getHttpServer())
      .post('/api/v1/auth/google')
      .send({ credential: credential(identity({ sub: user.googleSub!, email: newEmail })) })
      .expect(403);
  });
});
