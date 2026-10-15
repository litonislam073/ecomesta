import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { AffiliateProgramSettings } from '@ecomesta/types';
import { PrismaService } from '../../prisma/prisma.service';

type Db = Prisma.TransactionClient | PrismaService;

const KEY = 'affiliate';

/** Used when the setting row is missing (the migration inserts the same values). */
export const AFFILIATE_DEFAULTS: AffiliateProgramSettings = {
  enabled: true,
  commissionRate: 20,
  cookieDays: 30,
  holdDays: 7,
  minPayout: 500,
};

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** Settings as stored, with every value checked and the defaults filled in. */
export function readAffiliateSettings(raw: unknown): AffiliateProgramSettings {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  return {
    enabled: typeof source.enabled === 'boolean' ? source.enabled : AFFILIATE_DEFAULTS.enabled,
    commissionRate: Math.round(clamp(source.commissionRate, 0, 100, AFFILIATE_DEFAULTS.commissionRate) * 100) / 100,
    cookieDays: Math.round(clamp(source.cookieDays, 1, 365, AFFILIATE_DEFAULTS.cookieDays)),
    holdDays: Math.round(clamp(source.holdDays, 0, 90, AFFILIATE_DEFAULTS.holdDays)),
    minPayout: Math.round(clamp(source.minPayout, 0, 1_000_000, AFFILIATE_DEFAULTS.minPayout)),
  };
}

@Injectable()
export class AffiliateSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(db: Db = this.prisma): Promise<AffiliateProgramSettings> {
    const row = await db.platformSetting.findUnique({ where: { key: KEY } });
    return readAffiliateSettings(row?.value);
  }

  async update(patch: Partial<AffiliateProgramSettings>): Promise<AffiliateProgramSettings> {
    const next = readAffiliateSettings({ ...(await this.get()), ...patch });
    await this.prisma.platformSetting.upsert({
      where: { key: KEY },
      create: { key: KEY, value: next as unknown as Prisma.InputJsonValue },
      update: { value: next as unknown as Prisma.InputJsonValue },
    });
    return next;
  }
}
