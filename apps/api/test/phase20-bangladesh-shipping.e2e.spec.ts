import { ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import {
  MembershipStatus,
  StoreRole,
  StoreStatus,
  TenantStatus,
} from '@prisma/client';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { seedBangladeshLocations } from '../prisma/seed-bangladesh-locations';

describe('Phase 20 Bangladesh shipping zones (e2e)', () => {
  jest.setTimeout(90_000);

  let app: NestExpressApplication;
  let prisma: PrismaService;
  let redis: RedisService;
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;

  const manager = {
    email: `phase20.${suffix}@example.com`,
    password: 'SecurePass1',
    token: '',
    id: '',
  };
  const staff = {
    email: `phase20.staff.${suffix}@example.com`,
    password: 'SecurePass1',
    token: '',
    id: '',
  };
  const other = {
    email: `phase20.other.${suffix}@example.com`,
    password: 'SecurePass1',
    token: '',
    id: '',
  };

  let storeId = '';
  let storeSlug = '';
  let otherStoreId = '';
  let productId = '';
  let dhakaDivisionId = '';
  let dhakaDistrictId = '';
  let tejgaonId = '';
  let chattogramDivisionId = '';
  let chattogramDistrictId = '';
  let zoneDhakaId = '';
  let zoneOutsideId = '';
  let methodDhakaId = '';
  let methodOutsideId = '';
  let methodNoCodId = '';

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
    redis = app.get(RedisService);

    for (const pattern of ['auth:rl:*', 'rl:*']) {
      const keys = await redis.getClient().keys(pattern);
      if (keys.length > 0) {
        await redis.getClient().del(...keys);
      }
    }

    await seedBangladeshLocations(prisma);

    for (const user of [manager, staff, other]) {
      const registered = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: user.email,
          password: user.password,
          firstName: 'Phase',
          lastName: 'Twenty',
        })
        .expect(201);
      user.token = registered.body.data.accessToken;
      user.id = registered.body.data.user.id;
    }

    storeSlug = `bd-ship-${suffix}`;
    const onboard = await request(app.getHttpServer())
      .post('/api/v1/onboarding/store')
      .set('Authorization', `Bearer ${manager.token}`)
      .send({
        businessName: 'BD Ship Tenant',
        tenantSlug: `bd-ship-tenant-${suffix}`,
        storeName: 'BD Ship Store',
        storeSlug,
      })
      .expect(201);
    storeId = onboard.body.data.store.id;

    const onboardB = await request(app.getHttpServer())
      .post('/api/v1/onboarding/store')
      .set('Authorization', `Bearer ${other.token}`)
      .send({
        businessName: 'Other BD Tenant',
        tenantSlug: `bd-ship-tenant-b-${suffix}`,
        storeName: 'Other BD Store',
        storeSlug: `bd-other-${suffix}`,
      })
      .expect(201);
    otherStoreId = onboardB.body.data.store.id;

    await prisma.store.update({
      where: { id: storeId },
      data: { status: StoreStatus.ACTIVE, currency: 'BDT' },
    });

    await prisma.storeUser.create({
      data: {
        storeId,
        userId: staff.id,
        role: StoreRole.STORE_STAFF,
        status: MembershipStatus.ACTIVE,
      },
    });

    const product = await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeId}/products`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({
        name: 'BD Product',
        slug: `bd-prod-${suffix}`,
        status: 'ACTIVE',
        productType: 'PHYSICAL',
        basePrice: '500.00',
        trackInventory: false,
      })
      .expect(201);
    productId = product.body.data.id;

    const dhakaDiv = await prisma.bdDivision.findUniqueOrThrow({
      where: { code: 'DHAKA' },
    });
    dhakaDivisionId = dhakaDiv.id;
    const dhakaDist = await prisma.bdDistrict.findUniqueOrThrow({
      where: { code: 'DHAKA_DHAKA' },
    });
    dhakaDistrictId = dhakaDist.id;
    const tejgaon = await prisma.bdUpazila.findFirstOrThrow({
      where: { districtId: dhakaDistrictId, name: 'Tejgaon' },
    });
    tejgaonId = tejgaon.id;

    const ctgDiv = await prisma.bdDivision.findUniqueOrThrow({
      where: { code: 'CHATTOGRAM' },
    });
    chattogramDivisionId = ctgDiv.id;
    const ctgDist = await prisma.bdDistrict.findUniqueOrThrow({
      where: { code: 'CHATTOGRAM_CHATTOGRAM' },
    });
    chattogramDistrictId = ctgDist.id;
  });

  afterAll(async () => {
    await app?.close();
  });

  it('seeds location hierarchy without orphans or duplicate codes', async () => {
    const divisions = await prisma.bdDivision.count();
    const districts = await prisma.bdDistrict.count();
    const upazilas = await prisma.bdUpazila.count();
    expect(divisions).toBe(8);
    expect(districts).toBe(64);
    expect(upazilas).toBeGreaterThanOrEqual(100);

    const orphanDistricts = await prisma.$queryRaw<{ c: bigint }[]>`
      SELECT COUNT(*)::bigint AS c FROM bd_districts d
      LEFT JOIN bd_divisions v ON v.id = d.division_id
      WHERE v.id IS NULL
    `;
    expect(Number(orphanDistricts[0]!.c)).toBe(0);

    const orphanUpazilas = await prisma.$queryRaw<{ c: bigint }[]>`
      SELECT COUNT(*)::bigint AS c FROM bd_upazilas u
      LEFT JOIN bd_districts d ON d.id = u.district_id
      WHERE d.id IS NULL
    `;
    expect(Number(orphanUpazilas[0]!.c)).toBe(0);

    const dupDistrictCodes = await prisma.$queryRaw<{ c: bigint }[]>`
      SELECT COUNT(*)::bigint AS c FROM (
        SELECT code FROM bd_districts GROUP BY code HAVING COUNT(*) > 1
      ) t
    `;
    expect(Number(dupDistrictCodes[0]!.c)).toBe(0);
  });

  it('lists cascading public locations behind active store', async () => {
    const divs = await request(app.getHttpServer())
      .get(`/api/v1/public/stores/${storeSlug}/locations/divisions`)
      .expect(200);
    expect(divs.body.data.length).toBe(8);

    const dists = await request(app.getHttpServer())
      .get(
        `/api/v1/public/stores/${storeSlug}/locations/districts?divisionId=${dhakaDivisionId}`,
      )
      .expect(200);
    expect(dists.body.data.some((d: { id: string }) => d.id === dhakaDistrictId)).toBe(
      true,
    );

    const ups = await request(app.getHttpServer())
      .get(
        `/api/v1/public/stores/${storeSlug}/locations/upazilas?districtId=${dhakaDistrictId}`,
      )
      .expect(200);
    expect(ups.body.data.some((u: { id: string }) => u.id === tejgaonId)).toBe(true);

    await prisma.store.update({
      where: { id: storeId },
      data: { status: StoreStatus.SUSPENDED },
    });
    await request(app.getHttpServer())
      .get(`/api/v1/public/stores/${storeSlug}/locations/divisions`)
      .expect(403);
    await prisma.store.update({
      where: { id: storeId },
      data: { status: StoreStatus.ACTIVE },
    });
  });

  it('supports zone CRUD, isolation, staff write reject, and priority', async () => {
    const created = await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeId}/shipping-zones`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({
        name: 'Dhaka City',
        priority: 100,
        active: true,
        locations: [{ districtId: dhakaDistrictId }],
      })
      .expect(201);
    zoneDhakaId = created.body.data.id;

    const outside = await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeId}/shipping-zones`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({
        name: 'Outside Dhaka',
        priority: 10,
        active: true,
        locations: [{ divisionId: chattogramDivisionId }],
      })
      .expect(201);
    zoneOutsideId = outside.body.data.id;

    await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeId}/shipping-zones`)
      .set('Authorization', `Bearer ${staff.token}`)
      .send({
        name: 'Staff Zone',
        priority: 1,
        locations: [{ divisionId: dhakaDivisionId }],
      })
      .expect(403);

    await request(app.getHttpServer())
      .post(`/api/v1/stores/${otherStoreId}/shipping-zones`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({
        name: 'Hack',
        priority: 1,
        locations: [{ divisionId: dhakaDivisionId }],
      })
      .expect(403);

    await request(app.getHttpServer())
      .get(`/api/v1/stores/${storeId}/shipping-zones`)
      .set('Authorization', `Bearer ${staff.token}`)
      .expect(200);

    await request(app.getHttpServer())
      .get(`/api/v1/stores/${otherStoreId}/shipping-zones/${zoneDhakaId}`)
      .set('Authorization', `Bearer ${other.token}`)
      .expect(404);

    // Higher priority Dhaka district wins over lower Outside for Dhaka location
    const dhakaMethod = await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeId}/shipping-methods`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({
        name: 'Dhaka Delivery',
        type: 'FLAT',
        price: '60.00',
        zoneId: zoneDhakaId,
        freeShippingThreshold: '2000.00',
        codAllowed: true,
        estimatedDelivery: '1–2 days',
        active: true,
      })
      .expect(201);
    methodDhakaId = dhakaMethod.body.data.id;

    const outsideMethod = await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeId}/shipping-methods`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({
        name: 'Outside Delivery',
        type: 'FLAT',
        price: '120.00',
        zoneId: zoneOutsideId,
        freeShippingThreshold: '3000.00',
        codAllowed: true,
        active: true,
      })
      .expect(201);
    methodOutsideId = outsideMethod.body.data.id;

    const noCod = await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeId}/shipping-methods`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({
        name: 'Express No COD',
        type: 'FLAT',
        price: '150.00',
        zoneId: zoneDhakaId,
        codAllowed: false,
        active: true,
      })
      .expect(201);
    methodNoCodId = noCod.body.data.id;

    await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeId}/shipping-methods`)
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ name: 'Staff Method', type: 'FLAT', price: '1.00' })
      .expect(403);
  });

  it('quotes zone methods, free threshold, and ignores client money fields', async () => {
    const quote = await request(app.getHttpServer())
      .post(`/api/v1/public/stores/${storeSlug}/shipping/quote`)
      .send({
        divisionId: dhakaDivisionId,
        districtId: dhakaDistrictId,
        upazilaId: tejgaonId,
        items: [{ productId, quantity: 1 }],
      })
      .expect(201);

    expect(quote.body.data.zone.name).toBe('Dhaka City');
    const ids = quote.body.data.methods.map((m: { id: string }) => m.id);
    expect(ids).toContain(methodDhakaId);
    expect(ids).toContain(methodNoCodId);
    expect(ids).not.toContain(methodOutsideId);

    const dhakaQuote = quote.body.data.methods.find(
      (m: { id: string }) => m.id === methodDhakaId,
    );
    expect(dhakaQuote.amount).toBe('60.00');
    expect(dhakaQuote.freeShippingApplied).toBe(false);

    // Free shipping when subtotal after discount >= 2000 (4 × 500)
    const freeQuote = await request(app.getHttpServer())
      .post(`/api/v1/public/stores/${storeSlug}/shipping/quote`)
      .send({
        divisionId: dhakaDivisionId,
        districtId: dhakaDistrictId,
        upazilaId: tejgaonId,
        items: [{ productId, quantity: 4 }],
      })
      .expect(201);
    const freeMethod = freeQuote.body.data.methods.find(
      (m: { id: string }) => m.id === methodDhakaId,
    );
    expect(freeMethod.amount).toBe('0.00');
    expect(freeMethod.freeShippingApplied).toBe(true);

    const outsideQuote = await request(app.getHttpServer())
      .post(`/api/v1/public/stores/${storeSlug}/shipping/quote`)
      .send({
        divisionId: chattogramDivisionId,
        districtId: chattogramDistrictId,
        items: [{ productId, quantity: 1 }],
      })
      .expect(201);
    expect(outsideQuote.body.data.zone.name).toBe('Outside Dhaka');
    expect(
      outsideQuote.body.data.methods.some(
        (m: { id: string }) => m.id === methodOutsideId,
      ),
    ).toBe(true);

    await request(app.getHttpServer())
      .post(`/api/v1/public/stores/${storeSlug}/shipping/quote`)
      .send({
        divisionId: dhakaDivisionId,
        items: [{ productId, quantity: 1 }],
        subtotal: '99999.00',
        shippingTotal: '0.00',
      })
      .expect(400);
  });

  it('enforces COD vs codAllowed and snapshots zone/location on checkout', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/public/stores/${storeSlug}/checkout`)
      .set('Idempotency-Key', `p20-cod-reject-${suffix}`)
      .send({
        items: [{ productId, quantity: 1 }],
        customer: {
          name: 'Buyer',
          email: `buyer.${suffix}@example.com`,
        },
        shippingAddress: {
          name: 'Buyer',
          addressLine1: 'House 1',
          city: 'Dhaka',
          country: 'BD',
          divisionId: dhakaDivisionId,
          districtId: dhakaDistrictId,
          upazilaId: tejgaonId,
        },
        shippingMethodId: methodNoCodId,
        paymentProvider: 'COD',
        paymentMethod: 'CASH',
      })
      .expect(422);

    const checkout = await request(app.getHttpServer())
      .post(`/api/v1/public/stores/${storeSlug}/checkout`)
      .set('Idempotency-Key', `p20-ok-${suffix}`)
      .send({
        items: [{ productId, quantity: 1 }],
        customer: {
          name: 'Buyer',
          email: `buyer2.${suffix}@example.com`,
          phone: '01700000000',
        },
        shippingAddress: {
          name: 'Buyer',
          addressLine1: 'House 1, Road 2',
          city: 'Dhaka',
          country: 'BD',
          divisionId: dhakaDivisionId,
          districtId: dhakaDistrictId,
          upazilaId: tejgaonId,
        },
        shippingMethodId: methodDhakaId,
        paymentProvider: 'COD',
        paymentMethod: 'CASH',
      })
      .expect(201);

    expect(checkout.body.data.shippingTotal).toBe('60.00');
    expect(checkout.body.data.total).toBe('560.00');
    expect(checkout.body.data.shippingMethodName).toBe('Dhaka Delivery');

    const order = await prisma.order.findFirstOrThrow({
      where: { publicReference: checkout.body.data.publicReference },
      include: { addresses: true, payments: true },
    });
    expect(order.shippingZoneName).toBe('Dhaka City');
    expect(order.shippingTotal.toFixed(2)).toBe('60.00');
    expect(order.grandTotal.toFixed(2)).toBe('560.00');
    expect(order.payments[0]!.amount.toFixed(2)).toBe('560.00');

    const shippingAddr = order.addresses.find((a) => a.type === 'SHIPPING')!;
    expect(shippingAddr.divisionName).toBe('Dhaka');
    expect(shippingAddr.districtName).toBe('Dhaka');
    expect(shippingAddr.upazilaName).toBe('Tejgaon');
    expect(shippingAddr.divisionId).toBe(dhakaDivisionId);

    // Config change must not alter historical snapshot
    await request(app.getHttpServer())
      .patch(`/api/v1/stores/${storeId}/shipping-methods/${methodDhakaId}`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ price: '999.00', name: 'Renamed Dhaka' })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/api/v1/stores/${storeId}/shipping-zones/${zoneDhakaId}`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ name: 'Renamed Zone' })
      .expect(200);

    const reloaded = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
    });
    expect(reloaded.shippingTotal.toFixed(2)).toBe('60.00');
    expect(reloaded.shippingMethodName).toBe('Dhaka Delivery');
    expect(reloaded.shippingZoneName).toBe('Dhaka City');
  });

  it('blocks suspended tenant/store merchant writes', async () => {
    const tenant = await prisma.store.findUniqueOrThrow({
      where: { id: storeId },
      select: { tenantId: true },
    });
    await prisma.tenant.update({
      where: { id: tenant.tenantId },
      data: { status: TenantStatus.SUSPENDED },
    });
    await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeId}/shipping-zones`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({
        name: 'Blocked',
        priority: 1,
        locations: [{ divisionId: dhakaDivisionId }],
      })
      .expect(403);
    await prisma.tenant.update({
      where: { id: tenant.tenantId },
      data: { status: TenantStatus.ACTIVE },
    });
  });
});
