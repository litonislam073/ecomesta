import { createHash, createHmac } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AnalyticsDevice } from '@prisma/client';
import type { Request } from 'express';
import { RedisRateLimitService } from '../../common/rate-limit/redis-rate-limit.service';
import { clientIp } from '../../common/utils/request-host.util';
import { PrismaService } from '../../prisma/prisma.service';
import { PublicStorefrontService } from '../public-storefront/public-storefront.service';
import type { AnalyticsEventDto } from './dto/analytics.dto';

const BOT = /bot|crawl|spider|slurp|preview|headless|lighthouse|pingdom|facebookexternalhit|whatsapp|telegram|curl|wget|python|axios|node-fetch/i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STORE_CACHE_MS = 5 * 60 * 1000;

const KNOWN_SOURCES: [RegExp, string][] = [
  [/(^|\.)(facebook\.com|fb\.com|fb\.me)$|^(facebook|fb)$/, 'Facebook'],
  [/(^|\.)(messenger\.com|m\.me)$|^messenger$/, 'Messenger'],
  [/(^|\.)instagram\.com$|^(instagram|ig)$/, 'Instagram'],
  [/(^|\.)google\.[a-z.]+$|^google$/, 'Google'],
  [/(^|\.)bing\.com$|^bing$/, 'Bing'],
  [/(^|\.)(youtube\.com|youtu\.be)$|^(youtube|yt)$/, 'YouTube'],
  [/(^|\.)tiktok\.com$|^tiktok$/, 'TikTok'],
  [/(^|\.)(whatsapp\.com|wa\.me)$|^whatsapp$/, 'WhatsApp'],
  [/(^|\.)(t\.co|twitter\.com|x\.com)$|^(twitter|x)$/, 'X (Twitter)'],
  [/(^|\.)(linkedin\.com|lnkd\.in)$|^linkedin$/, 'LinkedIn'],
];

/** "l.facebook.com" → "Facebook"; "" → "Direct"; other hosts are kept (without www.). */
export function normalizeSource(raw: string | null | undefined): string {
  const value = (raw ?? '').trim().toLowerCase();
  if (!value) return 'Direct';
  let host = value;
  try {
    if (/^[a-z][a-z0-9+.-]*:\/\//.test(value)) host = new URL(value).hostname;
  } catch {
    host = value;
  }
  host = host.replace(/^www\./, '').replace(/[^a-z0-9._-]/g, '').slice(0, 80);
  if (!host) return 'Direct';
  for (const [pattern, name] of KNOWN_SOURCES) if (pattern.test(host)) return name;
  return host;
}

export function deviceOf(userAgent: string): AnalyticsDevice {
  if (/ipad|tablet|kindle|silk|playbook|(android(?!.*mobile))/i.test(userAgent)) return AnalyticsDevice.TABLET;
  if (/mobi|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(userAgent)) return AnalyticsDevice.MOBILE;
  return AnalyticsDevice.DESKTOP;
}

/** "/products/x?utm=1#top" → "/products/x" (at most 300 characters). */
export function cleanPath(path: string): string {
  const bare = path.split(/[?#]/)[0] ?? '/';
  const clean = bare.startsWith('/') ? bare : `/${bare}`;
  return clean.replace(/[^\x20-\x7e]/g, '').slice(0, 300) || '/';
}

/**
 * Records storefront events without cookies: a visitor is a hash of the IP
 * address and browser with a secret that changes daily, so it cannot be
 * traced back to a person or followed across days. Never fails a request.
 */
@Injectable()
export class AnalyticsIngestService {
  private readonly logger = new Logger(AnalyticsIngestService.name);
  private readonly stores = new Map<string, { id: string | null; until: number }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly storefront: PublicStorefrontService,
    private readonly rateLimit: RedisRateLimitService,
    private readonly config: ConfigService,
  ) {}

  async record(storeSlug: string, dto: AnalyticsEventDto, req: Request): Promise<void> {
    try {
      const userAgent = String(req.headers['user-agent'] ?? '').slice(0, 512);
      if (!userAgent || BOT.test(userAgent)) return;
      const storeId = await this.storeId(storeSlug);
      if (!storeId) return;
      const ip = clientIp(req) ?? 'unknown';
      if (!(await this.rateLimit.consume(`analytics:${storeId}:${ip}`, 600, 60 * 60))) return;
      await this.prisma.storeAnalyticsEvent.create({
        data: {
          storeId,
          type: dto.type,
          visitorHash: this.visitorHash(storeId, ip, userAgent),
          path: cleanPath(dto.path),
          productId: dto.productId && UUID.test(dto.productId) ? dto.productId : null,
          source: normalizeSource(dto.source),
          device: deviceOf(userAgent),
        },
      });
    } catch (err) {
      this.logger.warn(`Analytics event not recorded: ${(err as Error).name}`);
    }
  }

  visitorHash(storeId: string, ip: string, userAgent: string, now: Date = new Date()): string {
    const secret = this.config.get<string>('JWT_ACCESS_SECRET') ?? 'ecomesta-analytics';
    const daily = createHmac('sha256', secret).update(`analytics:${now.toISOString().slice(0, 10)}`).digest('hex');
    return createHash('sha256').update(`${daily}|${storeId}|${ip}|${userAgent}`).digest('hex').slice(0, 16);
  }

  /** Active store id by slug, remembered for a few minutes (unknown slugs too). */
  private async storeId(storeSlug: string): Promise<string | null> {
    const slug = storeSlug.trim().toLowerCase();
    const cached = this.stores.get(slug);
    if (cached && cached.until > Date.now()) return cached.id;
    let id: string | null = null;
    try {
      id = (await this.storefront.requireActiveStore(slug)).id;
    } catch {
      id = null;
    }
    if (this.stores.size > 5000) this.stores.clear();
    this.stores.set(slug, { id, until: Date.now() + STORE_CACHE_MS });
    return id;
  }
}
