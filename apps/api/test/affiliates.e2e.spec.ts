import { ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ThrottlerStorage } from '@nestjs/throttler';
import { PlatformRole } from '@prisma/client';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { AffiliatesService, maskBusinessName } from '../src/modules/affiliates/affiliates.service';
import { readAffiliateSettings } from '../src/modules/affiliates/affiliate-settings.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { activateOnboarded, withPayment } from './support/onboarding';

/**
 * Ecomesta's affiliate program: any account applies, a Super Admin approves,
 * referred sign-ups are credited, the referred business's first plan payment
 * earns a held commission, and the balance is withdrawn and marked paid.
 */
describe('Affiliate program (e2e)', () => {
  jest.setTimeout(120_000);

  let app: NestExpressApplication;
  let prisma: PrismaService;
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const referrer = { email: `aff.ref.${suffix}@example.com`, token: '', id: '' };
  const admin = { email: `aff.admin.${suffix}@example.com`, token: '', id: '' };
  const merchant = { email: `aff.merchant.${suffix}@example.com`, token: '', id: '' };
  let savedSettings: unknown = null;
  let code = '';

  const http = () => request(app.getHttpServer());
  const bearer = (u: { token: string }) => ({ Authorization: `Bearer ${u.token}` });
  const register = async (u: { email: string; token: string; id: string }, extra: Record<string, unknown> = {}) => {
    const res = await http()
      .post('/api/v1/auth/register')
      .send({ email: u.email, password: 'SecurePass1', firstName: 'Rahim', lastName: 'Test', ...extra })
      .expect(201);
    u.token = res.body.data.accessToken;
    u.id = res.body.data.user.id;
  };
  const me = async () => (await http().get('/api/v1/affiliate/me').set(bearer(referrer)).expect(200)).body.data;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ThrottlerStorage)
      .useValue({ increment: async () => ({ totalHits: 1, timeToExpire: 60 }) })
      .compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
    prisma = app.get(PrismaService);
    const redis = app.get(RedisService);
    for (const pattern of ['auth:rl:*', 'rl:*']) {
      const keys = await redis.getClient().keys(pattern);
      if (keys.length > 0) await redis.getClient().del(...keys);
    }
    savedSettings = (await prisma.platformSetting.findUnique({ where: { key: 'affiliate' } }))?.value ?? null;

    await register(referrer);
    await register(admin);
    await prisma.user.update({ where: { id: admin.id }, data: { platformRole: PlatformRole.SUPER_ADMIN } });
    admin.token = (
      await http().post('/api/v1/auth/login').send({ email: admin.email, password: 'SecurePass1' }).expect(200)
    ).body.data.accessToken;
    await http()
      .patch('/api/v1/admin/affiliates/settings')
      .set(bearer(admin))
      .send({ enabled: true, commissionRate: 20, cookieDays: 30, holdDays: 7, minPayout: 500 })
      .expect(200);
  });

  afterAll(async () => {
    if (prisma) {
      const users = [referrer.id, admin.id, merchant.id].filter(Boolean);
      const affiliates = await prisma.affiliate.findMany({ where: { userId: { in: users } }, select: { id: true } });
      const ids = affiliates.map((a) => a.id);
      await prisma.affiliatePayout.deleteMany({ where: { affiliateId: { in: ids } } });
      await prisma.affiliateCommission.deleteMany({ where: { affiliateId: { in: ids } } });
      await prisma.affiliateReferral.deleteMany({ where: { affiliateId: { in: ids } } });
      await prisma.affiliate.deleteMany({ where: { id: { in: ids } } });
      if (savedSettings) await prisma.platformSetting.update({ where: { key: 'affiliate' }, data: { value: savedSettings as object } });
    }
    await app?.close();
  });

  it('reads stored settings safely, filling and clamping values', () => {
    expect(readAffiliateSettings(null)).toEqual({ enabled: true, commissionRate: 20, cookieDays: 30, holdDays: 7, minPayout: 500 });
    expect(readAffiliateSettings({ commissionRate: 250, cookieDays: 0, holdDays: 'x', minPayout: -5 })).toMatchObject({
      commissionRate: 100,
      cookieDays: 1,
      holdDays: 7,
      minPayout: 0,
    });
    expect(maskBusinessName('Rahim Traders Ltd')).toBe('Ra*** T*** L***');
    expect(maskBusinessName('  ')).toBeNull();
  });

  it('lets any account apply; the link only works after approval', async () => {
    const before = await me();
    expect(before.affiliate).toBeNull();
    expect(before.program).toMatchObject({ commissionRate: 20, cookieDays: 30, holdDays: 7, minPayout: 500 });

    const applied = (await http().post('/api/v1/affiliate/apply').set(bearer(referrer)).send({ applicationNote: 'Facebook group' }).expect(200)).body.data;
    expect(applied.affiliate).toMatchObject({ status: 'PENDING', commissionRate: 20, applicationNote: 'Facebook group' });
    expect(applied.referralUrl).toBeNull();
    code = applied.affiliate.code;
    expect(code).toMatch(/^RAHIM\d{4}$/);
    await http().post('/api/v1/affiliate/apply').set(bearer(referrer)).send({}).expect(409);

    const click = await http().post('/api/v1/public/affiliate/click').send({ code }).expect(200);
    expect(click.body.data).toEqual({ valid: false, cookieDays: 30 });
  });

  it('keeps the admin endpoints for Super Admins', async () => {
    await http().get('/api/v1/admin/affiliates').set(bearer(referrer)).expect(403);
    await http().get('/api/v1/admin/affiliates/payouts').expect(401);
    const badges = await http().get('/api/v1/admin/badges').set(bearer(admin)).expect(200);
    expect(badges.body.data.pendingAffiliates).toBeGreaterThanOrEqual(1);
  });

  it('approves an application and emails the affiliate their link', async () => {
    const list = (await http().get('/api/v1/admin/affiliates?status=PENDING').set(bearer(admin)).expect(200)).body.data.items;
    const row = list.find((a: { code: string }) => a.code === code);
    expect(row).toMatchObject({ status: 'PENDING', user: { email: referrer.email }, balance: { available: 0 } });

    await http().post(`/api/v1/admin/affiliates/${row.id}/approve`).set(bearer(admin)).expect(200);
    await http().post(`/api/v1/admin/affiliates/${row.id}/approve`).set(bearer(admin)).expect(409);
    const after = await me();
    expect(after.affiliate.status).toBe('ACTIVE');
    expect(after.referralUrl).toMatch(new RegExp(`/\\?ref=${code}$`));
    const email = await prisma.emailDelivery.findFirst({ where: { eventType: 'AFFILIATE_APPROVED', userId: referrer.id } });
    expect(email).not.toBeNull();
  });

  it('counts clicks and credits a referred sign-up and its business', async () => {
    const click = await http().post('/api/v1/public/affiliate/click').send({ code: code.toLowerCase() }).expect(200);
    expect(click.body.data).toEqual({ valid: true, cookieDays: 30 });
    await http().post('/api/v1/public/affiliate/click').send({ code: 'NOPE0000' }).expect(200);

    await register(merchant, { referralCode: code.toLowerCase() });
    const referral = await prisma.affiliateReferral.findUnique({ where: { userId: merchant.id } });
    expect(referral?.tenantId).toBeNull();

    const slug = `aff-shop-${suffix}`;
    await http()
      .post('/api/v1/onboarding/store')
      .set(bearer(merchant))
      .send(withPayment({ planSlug: 'business', businessName: 'Karim Fashion House', tenantSlug: `${slug}-t`, storeName: 'Karim', storeSlug: slug }))
      .expect(201)
      .then(activateOnboarded(app));

    const stats = (await me()).stats;
    expect(stats).toEqual({ clicks: 1, signups: 1, businesses: 1, paidCustomers: 1 });
    const referrals = (await http().get('/api/v1/affiliate/referrals').set(bearer(referrer)).expect(200)).body.data.items;
    expect(referrals[0]).toMatchObject({ business: 'Ka*** F*** H***', status: 'PAID' });
  });

  it('records 20% of the first plan payment, held for 7 days, and only once', async () => {
    const payment = await prisma.billingPayment.findFirstOrThrow({ where: { submittedByUserId: merchant.id, status: 'APPROVED' } });
    const commissions = (await http().get('/api/v1/affiliate/commissions').set(bearer(referrer)).expect(200)).body.data.items;
    expect(commissions).toHaveLength(1);
    const expected = Math.round(Number(payment.amount) * 20) / 100;
    expect(commissions[0]).toMatchObject({ rate: 20, amount: expected, paymentAmount: Number(payment.amount), status: 'APPROVED' });
    const heldDays = (new Date(commissions[0].availableAt).getTime() - Date.now()) / 86_400_000;
    expect(heldDays).toBeGreaterThan(6.9);

    await app.get(AffiliatesService).recordFirstPayment(payment.id);
    expect(await prisma.affiliateCommission.count({ where: { billingPaymentId: payment.id } })).toBe(1);

    const balance = (await me()).balance;
    expect(balance).toMatchObject({ available: 0, onHold: expected, totalEarned: expected });
    const email = await prisma.emailDelivery.findFirst({ where: { eventType: 'AFFILIATE_COMMISSION_EARNED', userId: referrer.id } });
    expect(email).not.toBeNull();
  });

  it('withdraws only with a payout number, past the hold and above the minimum', async () => {
    const missing = await http().post('/api/v1/affiliate/payouts').set(bearer(referrer)).expect(400);
    expect(missing.body.error.code).toBe('AFFILIATE_PAYOUT_METHOD_MISSING');
    await http().put('/api/v1/affiliate/payout-method').set(bearer(referrer)).send({ method: 'BKASH', number: '123' }).expect(400);
    const saved = (await http().put('/api/v1/affiliate/payout-method').set(bearer(referrer)).send({ method: 'BKASH', number: '+88 01712-345678', name: 'Rahim' }).expect(200)).body.data;
    expect(saved.affiliate).toMatchObject({ payoutMethod: 'BKASH', payoutNumber: '01712345678' });

    const held = await http().post('/api/v1/affiliate/payouts').set(bearer(referrer)).expect(400);
    expect(held.body.error.code).toBe('AFFILIATE_BELOW_MINIMUM');

    const affiliate = await prisma.affiliate.findUniqueOrThrow({ where: { userId: referrer.id } });
    await prisma.affiliateCommission.updateMany({ where: { affiliateId: affiliate.id }, data: { availableAt: new Date(Date.now() - 1000) } });
    const earned = (await me()).balance.available;
    expect(earned).toBeGreaterThan(0);

    await http().patch('/api/v1/admin/affiliates/settings').set(bearer(admin)).send({ minPayout: Math.ceil(earned) + 1 }).expect(200);
    await http().post('/api/v1/affiliate/payouts').set(bearer(referrer)).expect(400);
    await http().patch('/api/v1/admin/affiliates/settings').set(bearer(admin)).send({ minPayout: 1 }).expect(200);

    const payout = (await http().post('/api/v1/affiliate/payouts').set(bearer(referrer)).expect(200)).body.data;
    expect(payout).toMatchObject({ amount: earned, method: 'BKASH', number: '01712345678', status: 'REQUESTED' });
    await http().post('/api/v1/affiliate/payouts').set(bearer(referrer)).expect(409);
    expect((await me()).balance).toMatchObject({ available: 0, requested: earned });

    // Past its hold, a commission can no longer be taken back.
    const commission = await prisma.affiliateCommission.findFirstOrThrow({ where: { affiliateId: affiliate.id } });
    await http().post(`/api/v1/admin/affiliates/commissions/${commission.id}/reject`).set(bearer(admin)).send({ reason: 'Refunded' }).expect(409);
  });

  it('marks a withdrawal paid once and emails the affiliate', async () => {
    const affiliate = await prisma.affiliate.findUniqueOrThrow({ where: { userId: referrer.id } });
    const payout = await prisma.affiliatePayout.findFirstOrThrow({ where: { affiliateId: affiliate.id } });
    await http().post(`/api/v1/admin/affiliates/payouts/${payout.id}/paid`).set(bearer(admin)).send({ transactionId: 'abc12345' }).expect(200);
    await http().post(`/api/v1/admin/affiliates/payouts/${payout.id}/reject`).set(bearer(admin)).send({ reason: 'Wrong number' }).expect(409);

    const payouts = (await http().get('/api/v1/affiliate/payouts').set(bearer(referrer)).expect(200)).body.data.items;
    expect(payouts[0]).toMatchObject({ status: 'PAID', transactionId: 'ABC12345' });
    expect((await me()).balance).toMatchObject({ available: 0, requested: 0, paid: Number(payout.amount) });
    expect(await prisma.emailDelivery.count({ where: { eventType: 'AFFILIATE_PAYOUT_PAID', userId: referrer.id } })).toBe(1);
  });

  it('can reject a commission while it is on hold, and suspend an affiliate', async () => {
    const affiliate = await prisma.affiliate.findUniqueOrThrow({ where: { userId: referrer.id } });
    const commission = await prisma.affiliateCommission.findFirstOrThrow({ where: { affiliateId: affiliate.id } });
    await prisma.affiliateCommission.update({ where: { id: commission.id }, data: { availableAt: new Date(Date.now() + 86_400_000) } });
    await http().post(`/api/v1/admin/affiliates/commissions/${commission.id}/reject`).set(bearer(admin)).send({ reason: 'Refunded' }).expect(200);
    expect((await me()).balance.onHold).toBe(0);

    await http().patch(`/api/v1/admin/affiliates/${affiliate.id}/rate`).set(bearer(admin)).send({ rate: 30 }).expect(200);
    expect((await me()).affiliate.commissionRate).toBe(30);
    await http().post(`/api/v1/admin/affiliates/${affiliate.id}/suspend`).set(bearer(admin)).send({ reason: 'Spam' }).expect(200);
    const suspended = await me();
    expect(suspended.affiliate).toMatchObject({ status: 'SUSPENDED', statusReason: 'Spam' });
    expect(suspended.referralUrl).toBeNull();
    expect((await http().post('/api/v1/public/affiliate/click').send({ code }).expect(200)).body.data.valid).toBe(false);
    await http().post(`/api/v1/admin/affiliates/${affiliate.id}/reactivate`).set(bearer(admin)).expect(200);
  });
});
