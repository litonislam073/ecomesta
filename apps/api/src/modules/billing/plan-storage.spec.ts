import { Prisma } from '@prisma/client';
import { readPlanLimits } from './plan-catalog';
import { DEFAULT_PLANS } from './plan-defaults';
import { PlanEntitlementsService, formatStorage } from './plan-entitlements.service';

const MB = 1024 * 1024;

describe('plan product and storage limits', () => {
  it('sets Starter 25 products / 1 GB, Growth 100 / 3 GB, Business unlimited / 5 GB', () => {
    const bySlug = Object.fromEntries(DEFAULT_PLANS.map((plan) => [plan.slug, plan]));
    expect(bySlug.starter!.limits).toMatchObject({ maxProducts: 25, storageMb: 1024 });
    expect(bySlug.growth!.limits).toMatchObject({ maxProducts: 100, storageMb: 3072 });
    expect(bySlug.business!.limits).toMatchObject({ maxProducts: null, storageMb: 5120 });
    expect(bySlug.starter!.features).toEqual(expect.arrayContaining(['Up to 25 products with variants and categories', '1 GB storage']));
    expect(bySlug.growth!.features).toEqual(expect.arrayContaining(['Up to 100 products', '3 GB storage']));
    expect(bySlug.business!.features).toEqual(expect.arrayContaining(['Unlimited products', '5 GB storage']));
  });

  it('reads storage from the plan; a missing or bad value means unlimited', () => {
    expect(readPlanLimits({ limits: { maxProducts: 25, storageMb: 1024 } })).toMatchObject({ storageMb: 1024 });
    expect(readPlanLimits({ limits: { maxProducts: 25 } })).toMatchObject({ storageMb: null });
    expect(readPlanLimits({ limits: { storageMb: -1 } })).toMatchObject({ storageMb: null });
    expect(readPlanLimits({ limits: { storageMb: 1.5 } })).toMatchObject({ storageMb: null });
  });

  it('shows sizes the way merchants read them', () => {
    expect(formatStorage(1024 * MB)).toBe('1 GB');
    expect(formatStorage(5 * 1024 * MB)).toBe('5 GB');
    expect(formatStorage(1000 * MB)).toBe('1000 MB');
    expect(formatStorage(Math.round(2.5 * 1024 * MB))).toBe('2.50 GB');
    expect(formatStorage(1)).toBe('1 MB');
  });

  describe('limitsForTenant fails closed', () => {
    const plan = (slug: string, sortOrder: number, limits: Record<string, unknown> | null) => ({
      name: slug,
      slug,
      monthlyPrice: new Prisma.Decimal(sortOrder * 100),
      configuration: { sortOrder, ...(limits ? { limits } : {}) },
    });
    function db(opts: { subscription?: object; payment?: object }) {
      return {
        subscription: { findMany: jest.fn().mockResolvedValue(opts.subscription ? [opts.subscription] : []) },
        billingPayment: { findFirst: jest.fn().mockResolvedValue(opts.payment ?? null) },
        subscriptionPlan: {
          findMany: jest.fn().mockResolvedValue([
            plan('business', 3, { maxProducts: null, storageMb: 5120 }),
            plan('legacy', 0, null),
            plan('starter', 1, { maxProducts: 25, storageMb: 1024 }),
          ]),
        },
      };
    }
    const service = new PlanEntitlementsService({} as never);

    it("uses the subscription's plan", async () => {
      const limits = await service.limitsForTenant('t1', db({
        subscription: { status: 'ACTIVE', createdAt: new Date(), plan: { configuration: { limits: { maxProducts: 100, storageMb: 3072 } } } },
      }) as never);
      expect(limits).toMatchObject({ maxProducts: 100, storageMb: 3072 });
    });

    it('uses the plan the business paid for while that payment waits for approval', async () => {
      const limits = await service.limitsForTenant('t1', db({ payment: { plan: { configuration: { limits: { maxProducts: 25, storageMb: 1024 } } } } }) as never);
      expect(limits).toMatchObject({ maxProducts: 25, storageMb: 1024 });
    });

    it('falls back to the smallest limited plan — never unlimited — with neither', async () => {
      const limits = await service.limitsForTenant('t1', db({}) as never);
      expect(limits).toMatchObject({ maxProducts: 25, storageMb: 1024, coupons: false });
    });
  });

  describe('assertStorageCapacity', () => {
    function setup(storageMb: number | null, usedBytes: number) {
      const tx = {
        store: { findUnique: jest.fn().mockResolvedValue({ tenantId: 't1' }) },
        subscription: {
          findMany: jest.fn().mockResolvedValue([
            { status: 'ACTIVE', createdAt: new Date(), plan: { configuration: { limits: { maxProducts: 25, storageMb } } } },
          ]),
        },
        $queryRaw: jest.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([{ used: BigInt(usedBytes) }]),
      };
      const prisma = {
        subscriptionPlan: {
          findMany: jest.fn().mockResolvedValue([
            { name: 'Growth', slug: 'growth', monthlyPrice: new Prisma.Decimal(299), configuration: { sortOrder: 2, limits: { storageMb: 3072 } } },
          ]),
        },
      };
      const service = new PlanEntitlementsService(prisma as never);
      return { service, tx: tx as unknown as Prisma.TransactionClient, raw: tx.$queryRaw };
    }

    it('allows an upload that fits, up to exactly the limit', async () => {
      const { service, tx } = setup(1024, 1024 * MB - 500);
      await expect(service.assertStorageCapacity(tx, 's1', 500)).resolves.toBeUndefined();
    });

    it('refuses an upload past the limit, naming the plans that allow more', async () => {
      const { service, tx } = setup(1024, 1024 * MB - 500);
      await expect(service.assertStorageCapacity(tx, 's1', 501)).rejects.toMatchObject({
        response: expect.objectContaining({ error: 'PLAN_UPGRADE_REQUIRED' }),
      });
      const again = setup(1024, 1024 * MB - 500);
      await again.service.assertStorageCapacity(again.tx, 's1', 501).catch((err: { message: string }) => {
        expect(err.message).toMatch(/includes 1 GB of storage and you have used 1024 MB/);
        expect(err.message).toMatch(/Growth/);
      });
    });

    it('does not limit a plan without a storage limit', async () => {
      const { service, tx, raw } = setup(null, 50 * 1024 * MB);
      await expect(service.assertStorageCapacity(tx, 's1', 10 * MB)).resolves.toBeUndefined();
      expect(raw).not.toHaveBeenCalled();
    });
  });
});
