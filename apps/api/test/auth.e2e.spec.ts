import { ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import { UserStatus } from '@prisma/client';

describe('Auth (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  const unique = Date.now();
  const email = `phase3.user.${unique}@example.com`;
  const password = 'SecurePass1';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();

    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.authSession.deleteMany({
      where: { user: { email: { contains: `phase3.user.${unique}` } } },
    });
    await prisma.user.deleteMany({
      where: { email: { contains: `phase3.user.${unique}` } },
    });
    await app.close();
  });

  it('registers a user', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email,
        password,
        firstName: 'Phase',
        lastName: 'Three',
      })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();
    expect(res.body.data.user.email).toBe(email);
    expect(res.body.data.user.passwordHash).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
    expect(JSON.stringify(res.body)).not.toContain('tokenHash');
  });

  it('rejects duplicate email', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email,
        password,
        firstName: 'Phase',
        lastName: 'Three',
      })
      .expect(409);
  });

  it('rejects invalid email', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'not-an-email',
        password,
        firstName: 'Phase',
        lastName: 'Three',
      })
      .expect(400);
  });

  it('rejects weak password', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `weak.${unique}@example.com`,
        password: 'short',
        firstName: 'Phase',
        lastName: 'Three',
      })
      .expect(400);
  });

  it('logs in successfully', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);

    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();
  });

  it('rejects wrong password with generic error', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'WrongPass1' })
      .expect(401);

    expect(res.body.error.message).toBe('Invalid email or password.');
  });

  it('blocks suspended users from login', async () => {
    await prisma.user.update({
      where: { email },
      data: { status: UserStatus.SUSPENDED },
    });

    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(403);

    await prisma.user.update({
      where: { email },
      data: { status: UserStatus.ACTIVE },
    });
  });

  it('authenticates /me with access token and omits secrets', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);

    const me = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${login.body.data.accessToken}`)
      .expect(200);

    expect(me.body.data.email).toBe(email);
    expect(me.body.data.memberships).toBeDefined();
    expect(me.body.data.passwordHash).toBeUndefined();
    expect(JSON.stringify(me.body)).not.toContain('passwordHash');
    expect(JSON.stringify(me.body)).not.toContain('tokenHash');
  });

  it('returns 401 for missing access token', async () => {
    await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
  });

  it('rotates refresh tokens and rejects reused token', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);

    const oldRefresh = login.body.data.refreshToken as string;

    const refreshed = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: oldRefresh })
      .expect(200);

    expect(refreshed.body.data.accessToken).toBeDefined();
    expect(refreshed.body.data.refreshToken).toBeDefined();
    expect(refreshed.body.data.refreshToken).not.toBe(oldRefresh);

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: oldRefresh })
      .expect(401);
  });

  it('logout invalidates the session', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);

    const accessToken = login.body.data.accessToken as string;
    const refreshToken = login.body.data.refreshToken as string;

    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(401);

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken })
      .expect(401);
  });
});
