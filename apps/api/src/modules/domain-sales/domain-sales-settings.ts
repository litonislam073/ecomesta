import type { Prisma } from '@prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';

export interface DomainSalesSettings {
  /** Shown on the website and dashboard; off hides search and buying. */
  enabled: boolean;
  /** Taka per US dollar used to price registrar costs. */
  usdRate: number;
  /** Ecomesta's profit per year, in taka. */
  marginBdt: number;
  /** Extensions offered, without the dot, in search order. */
  tlds: string[];
  maxYears: number;
}

export const DOMAIN_SALES_SETTINGS_KEY = 'domain_sales';

export const DOMAIN_SALES_DEFAULTS: DomainSalesSettings = {
  enabled: true,
  usdRate: 125,
  marginBdt: 250,
  tlds: ['com', 'net', 'shop', 'store', 'online', 'xyz'],
  maxYears: 5,
};

const TLD = /^[a-z]{2,24}$/;

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

/** Stored settings with every value checked and defaults filled in. */
export function readDomainSalesSettings(raw: unknown): DomainSalesSettings {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const tlds = Array.isArray(source.tlds)
    ? [...new Set(source.tlds.map((t) => String(t).trim().toLowerCase().replace(/^\./, '')).filter((t) => TLD.test(t)))].slice(0, 20)
    : DOMAIN_SALES_DEFAULTS.tlds;
  return {
    enabled: typeof source.enabled === 'boolean' ? source.enabled : DOMAIN_SALES_DEFAULTS.enabled,
    usdRate: Math.round(clamp(source.usdRate, 1, 1000, DOMAIN_SALES_DEFAULTS.usdRate) * 100) / 100,
    marginBdt: Math.round(clamp(source.marginBdt, 0, 100_000, DOMAIN_SALES_DEFAULTS.marginBdt)),
    tlds: tlds.length ? tlds : DOMAIN_SALES_DEFAULTS.tlds,
    maxYears: Math.round(clamp(source.maxYears, 1, 10, DOMAIN_SALES_DEFAULTS.maxYears)),
  };
}

export async function loadDomainSalesSettings(db: Pick<PrismaService, 'platformSetting'> | Prisma.TransactionClient) {
  const row = await db.platformSetting.findUnique({ where: { key: DOMAIN_SALES_SETTINGS_KEY } });
  return readDomainSalesSettings(row?.value);
}

/**
 * Taka price per year: registrar USD cost × rate, rounded up to the next ৳10,
 * plus the margin. Rounded so prices look like prices (৳1,703 → ৳1,710).
 */
export function yearlyPriceBdt(usd: number, settings: Pick<DomainSalesSettings, 'usdRate' | 'marginBdt'>): number {
  return Math.ceil((usd * settings.usdRate) / 10) * 10 + settings.marginBdt;
}

/** `amarshop` or `amarshop.com` → a clean label and an optional extension. */
export function parseDomainQuery(raw: string): { label: string; tld: string | null } | null {
  const cleaned = raw.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0] ?? '';
  const [labelPart, ...rest] = cleaned.split('.');
  const label = (labelPart ?? '').replace(/[^a-z0-9-]/g, '').replace(/^-+|-+$/g, '');
  if (label.length < 2 || label.length > 63) return null;
  const tld = rest.join('.');
  return { label, tld: tld && TLD.test(tld) ? tld : null };
}

/** A full name we sell: `label.tld` with an offered extension. */
export function isSellableDomain(domain: string, settings: Pick<DomainSalesSettings, 'tlds'>): boolean {
  const match = /^([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)\.([a-z]{2,24})$/.exec(domain);
  return Boolean(match && settings.tlds.includes(match[2]!));
}
