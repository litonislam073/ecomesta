import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AnalyticsDevice, StoreAnalytics, StoreAnalyticsDay, StoreAnalyticsTotals } from '@ecomesta/types';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthorizationService } from '../authorization/authorization.service';
import { PlanEntitlementsService } from '../billing/plan-entitlements.service';
import {
  addDays,
  daysBetween,
  eachDay,
  isCalendarDate,
  startOfDayUtc,
  todayIn,
  validTimezone,
} from './analytics-dates';
import type { AnalyticsRangeQueryDto } from './dto/analytics.dto';

/** Days a Starter plan can look back. */
export const BASIC_ANALYTICS_DAYS = 30;
/** Longest range one report covers. */
export const MAX_ANALYTICS_DAYS = 366;

/** Orders that count as sales: placed, not cancelled, and not failed or refunded. */
const SALE = Prisma.sql`o.status NOT IN ('DRAFT', 'CANCELLED') AND o.payment_status NOT IN ('FAILED', 'CANCELLED', 'REFUNDED')`;

interface Window {
  from: string;
  to: string;
  start: Date;
  end: Date;
}

/**
 * A UTC instant as the plain timestamp the columns hold. Comparing a column
 * with a timestamptz parameter directly would shift it by the database
 * session's time zone.
 */
const utc = (instant: Date) => Prisma.sql`(${instant}::timestamptz AT TIME ZONE 'UTC')`;
const money = (value: number) => Math.round(value * 100) / 100;
const n = (value: unknown) => (value == null ? 0 : Number(value));

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
    private readonly entitlements: PlanEntitlementsService,
  ) {}

  async report(userId: string, storeId: string, query: AnalyticsRangeQueryDto) {
    await this.authorization.assertStoreAccess(userId, storeId);
    const { store, full, range, previous } = await this.resolve(storeId, query);
    const tz = store.timezone;

    const [current, before, series, orderStatuses] = await Promise.all([
      this.totals(storeId, range, full),
      this.totals(storeId, previous, full),
      this.series(storeId, range, tz, full),
      this.orderStatuses(storeId, range),
    ]);

    const data: StoreAnalytics = {
      full,
      currency: store.currency,
      timezone: tz,
      range: { from: range.from, to: range.to, days: daysBetween(range.from, range.to) },
      previousRange: { from: previous.from, to: previous.to },
      totals: current,
      previous: before,
      series,
      orderStatuses,
      topProducts: null,
      sources: null,
      pages: null,
      devices: null,
      funnel: null,
      paymentMethods: null,
      customers: null,
    };

    if (full) {
      const [topProducts, sources, pages, devices, funnel, paymentMethods, customers] = await Promise.all([
        this.topProducts(storeId, range),
        this.sources(storeId, range),
        this.pages(storeId, range),
        this.devices(storeId, range),
        this.funnel(storeId, range, current.orders),
        this.paymentMethods(storeId, range),
        this.customers(storeId, range),
      ]);
      Object.assign(data, { topProducts, sources, pages, devices, funnel, paymentMethods, customers });
    }
    return { success: true as const, data };
  }

  /** One row per day, for spreadsheets (full analytics only). */
  async exportCsv(userId: string, storeId: string, query: AnalyticsRangeQueryDto): Promise<{ filename: string; csv: string }> {
    await this.authorization.assertStoreAccess(userId, storeId);
    await this.entitlements.assertFeature(storeId, 'advancedAnalytics');
    const { store, range } = await this.resolve(storeId, query);
    const series = await this.series(storeId, range, store.timezone, true);
    const views = await this.dailyPageViews(storeId, range, store.timezone);
    const lines = [`Date,Orders,Sales (${store.currency}),Visitors,Page views`];
    for (const day of series) {
      lines.push([day.date, day.orders, day.revenue.toFixed(2), day.visitors ?? 0, views.get(day.date) ?? 0].join(','));
    }
    return { filename: `${store.slug}-analytics-${range.from}-to-${range.to}.csv`, csv: `${lines.join('\n')}\n` };
  }

  // ---------------------------------------------------------------------------

  /**
   * The requested days in the store's time zone (default: the last 30 days)
   * and the same number of days before them. Without full analytics only the
   * last 30 days can be shown.
   */
  private async resolve(storeId: string, query: AnalyticsRangeQueryDto) {
    const row = await this.prisma.store.findUnique({
      where: { id: storeId },
      select: { id: true, slug: true, currency: true, timezone: true },
    });
    if (!row) throw new NotFoundException('Store not found');
    const store = { ...row, timezone: validTimezone(row.timezone) };
    const full = await this.entitlements.hasFeature(storeId, 'advancedAnalytics');

    const today = todayIn(store.timezone);
    for (const value of [query.from, query.to]) {
      if (value && !isCalendarDate(value)) throw new BadRequestException(`${value} is not a date.`);
    }
    let to = query.to ?? today;
    if (to > today) to = today;
    const from = query.from ?? addDays(to, -(BASIC_ANALYTICS_DAYS - 1));
    if (from > to) throw new BadRequestException('The start date must be on or before the end date.');
    const days = daysBetween(from, to);
    if (days > MAX_ANALYTICS_DAYS) throw new BadRequestException(`Choose a range of at most ${MAX_ANALYTICS_DAYS} days.`);
    if (!full && from < addDays(today, -(BASIC_ANALYTICS_DAYS - 1))) {
      // Older days are part of full analytics (Growth and Business).
      await this.entitlements.assertFeature(storeId, 'advancedAnalytics');
    }
    const previousTo = addDays(from, -1);
    const previousFrom = addDays(previousTo, -(days - 1));
    return {
      store,
      full,
      range: this.window(from, to, store.timezone),
      previous: this.window(previousFrom, previousTo, store.timezone),
    };
  }

  private window(from: string, to: string, tz: string): Window {
    return { from, to, start: startOfDayUtc(from, tz), end: startOfDayUtc(addDays(to, 1), tz) };
  }

  private async totals(storeId: string, w: Window, full: boolean): Promise<StoreAnalyticsTotals> {
    const [sales] = await this.prisma.$queryRaw<{ orders: number; revenue: number }[]>`
      SELECT count(*)::int AS orders, coalesce(sum(o.grand_total), 0)::float8 AS revenue
      FROM orders o
      WHERE o.store_id = ${storeId}::uuid AND o.created_at >= ${utc(w.start)} AND o.created_at < ${utc(w.end)} AND ${SALE}`;
    const [items] = await this.prisma.$queryRaw<{ items: number }[]>`
      SELECT coalesce(sum(i.quantity), 0)::int AS items
      FROM order_items i JOIN orders o ON o.id = i.order_id
      WHERE o.store_id = ${storeId}::uuid AND o.created_at >= ${utc(w.start)} AND o.created_at < ${utc(w.end)} AND ${SALE}`;
    const orders = n(sales?.orders);
    const revenue = money(n(sales?.revenue));
    let visitors: number | null = null;
    let pageViews: number | null = null;
    if (full) {
      const [traffic] = await this.prisma.$queryRaw<{ visitors: number; views: number }[]>`
        SELECT count(DISTINCT visitor_hash)::int AS visitors,
               (count(*) FILTER (WHERE type = 'PAGE_VIEW'))::int AS views
        FROM store_analytics_events
        WHERE store_id = ${storeId}::uuid AND created_at >= ${utc(w.start)} AND created_at < ${utc(w.end)}`;
      visitors = n(traffic?.visitors);
      pageViews = n(traffic?.views);
    }
    return {
      revenue,
      orders,
      averageOrder: orders ? money(revenue / orders) : 0,
      itemsSold: n(items?.items),
      visitors,
      pageViews,
      // Capped at 100%: orders placed before visits were recorded would push it above.
      conversionRate: visitors ? Math.min(100, Math.round((orders / visitors) * 10000) / 100) : visitors === 0 ? 0 : null,
    };
  }

  private async series(storeId: string, w: Window, tz: string, full: boolean): Promise<StoreAnalyticsDay[]> {
    const sales = await this.prisma.$queryRaw<{ day: string; orders: number; revenue: number }[]>`
      SELECT to_char((o.created_at AT TIME ZONE 'UTC') AT TIME ZONE ${tz}, 'YYYY-MM-DD') AS day,
             count(*)::int AS orders, coalesce(sum(o.grand_total), 0)::float8 AS revenue
      FROM orders o
      WHERE o.store_id = ${storeId}::uuid AND o.created_at >= ${utc(w.start)} AND o.created_at < ${utc(w.end)} AND ${SALE}
      GROUP BY 1`;
    const byDay = new Map(sales.map((row) => [row.day, row]));
    let visitors = new Map<string, number>();
    if (full) {
      const rows = await this.prisma.$queryRaw<{ day: string; visitors: number }[]>`
        SELECT to_char((created_at AT TIME ZONE 'UTC') AT TIME ZONE ${tz}, 'YYYY-MM-DD') AS day,
               count(DISTINCT visitor_hash)::int AS visitors
        FROM store_analytics_events
        WHERE store_id = ${storeId}::uuid AND created_at >= ${utc(w.start)} AND created_at < ${utc(w.end)}
        GROUP BY 1`;
      visitors = new Map(rows.map((row) => [row.day, n(row.visitors)]));
    }
    return eachDay(w.from, w.to).map((date) => ({
      date,
      orders: n(byDay.get(date)?.orders),
      revenue: money(n(byDay.get(date)?.revenue)),
      visitors: full ? (visitors.get(date) ?? 0) : null,
    }));
  }

  private async dailyPageViews(storeId: string, w: Window, tz: string): Promise<Map<string, number>> {
    const rows = await this.prisma.$queryRaw<{ day: string; views: number }[]>`
      SELECT to_char((created_at AT TIME ZONE 'UTC') AT TIME ZONE ${tz}, 'YYYY-MM-DD') AS day, count(*)::int AS views
      FROM store_analytics_events
      WHERE store_id = ${storeId}::uuid AND type = 'PAGE_VIEW' AND created_at >= ${utc(w.start)} AND created_at < ${utc(w.end)}
      GROUP BY 1`;
    return new Map(rows.map((row) => [row.day, n(row.views)]));
  }

  private async orderStatuses(storeId: string, w: Window) {
    const rows = await this.prisma.$queryRaw<{ status: string; orders: number }[]>`
      SELECT o.status::text AS status, count(*)::int AS orders
      FROM orders o
      WHERE o.store_id = ${storeId}::uuid AND o.created_at >= ${utc(w.start)} AND o.created_at < ${utc(w.end)} AND o.status <> 'DRAFT'
      GROUP BY 1 ORDER BY 2 DESC`;
    return rows.map((row) => ({ status: row.status, orders: n(row.orders) }));
  }

  private async topProducts(storeId: string, w: Window) {
    const rows = await this.prisma.$queryRaw<{ product_id: string | null; name: string; quantity: number; revenue: number }[]>`
      SELECT i.product_id, max(i.product_name) AS name,
             sum(i.quantity)::int AS quantity, coalesce(sum(i.total_price), 0)::float8 AS revenue
      FROM order_items i JOIN orders o ON o.id = i.order_id
      WHERE o.store_id = ${storeId}::uuid AND o.created_at >= ${utc(w.start)} AND o.created_at < ${utc(w.end)} AND ${SALE}
      GROUP BY i.product_id, CASE WHEN i.product_id IS NULL THEN i.product_name END
      ORDER BY revenue DESC, quantity DESC
      LIMIT 10`;
    return rows.map((row) => ({ productId: row.product_id, name: row.name, quantity: n(row.quantity), revenue: money(n(row.revenue)) }));
  }

  private async sources(storeId: string, w: Window) {
    const rows = await this.prisma.$queryRaw<{ source: string; visitors: number }[]>`
      SELECT source, count(DISTINCT visitor_hash)::int AS visitors
      FROM store_analytics_events
      WHERE store_id = ${storeId}::uuid AND created_at >= ${utc(w.start)} AND created_at < ${utc(w.end)}
      GROUP BY 1 ORDER BY 2 DESC LIMIT 10`;
    return rows.map((row) => ({ source: row.source, visitors: n(row.visitors) }));
  }

  private async pages(storeId: string, w: Window) {
    const rows = await this.prisma.$queryRaw<{ path: string; views: number }[]>`
      SELECT path, count(*)::int AS views
      FROM store_analytics_events
      WHERE store_id = ${storeId}::uuid AND type = 'PAGE_VIEW' AND created_at >= ${utc(w.start)} AND created_at < ${utc(w.end)}
      GROUP BY 1 ORDER BY 2 DESC LIMIT 10`;
    return rows.map((row) => ({ path: row.path, views: n(row.views) }));
  }

  private async devices(storeId: string, w: Window) {
    const rows = await this.prisma.$queryRaw<{ device: AnalyticsDevice; visitors: number }[]>`
      SELECT device::text AS device, count(DISTINCT visitor_hash)::int AS visitors
      FROM store_analytics_events
      WHERE store_id = ${storeId}::uuid AND created_at >= ${utc(w.start)} AND created_at < ${utc(w.end)}
      GROUP BY 1 ORDER BY 2 DESC`;
    return rows.map((row) => ({ device: row.device, visitors: n(row.visitors) }));
  }

  private async funnel(storeId: string, w: Window, orders: number) {
    const [row] = await this.prisma.$queryRaw<
      { visitors: number; product_views: number; add_to_cart: number; checkout: number }[]
    >`
      SELECT count(DISTINCT visitor_hash)::int AS visitors,
             count(DISTINCT visitor_hash) FILTER (WHERE type = 'PRODUCT_VIEW')::int AS product_views,
             count(DISTINCT visitor_hash) FILTER (WHERE type = 'ADD_TO_CART')::int AS add_to_cart,
             count(DISTINCT visitor_hash) FILTER (WHERE type = 'CHECKOUT_START')::int AS checkout
      FROM store_analytics_events
      WHERE store_id = ${storeId}::uuid AND created_at >= ${utc(w.start)} AND created_at < ${utc(w.end)}`;
    return {
      visitors: n(row?.visitors),
      productViews: n(row?.product_views),
      addToCart: n(row?.add_to_cart),
      checkout: n(row?.checkout),
      orders,
    };
  }

  /** By the provider of each order's latest payment attempt. */
  private async paymentMethods(storeId: string, w: Window) {
    const rows = await this.prisma.$queryRaw<{ provider: string; orders: number; revenue: number }[]>`
      SELECT provider, count(*)::int AS orders, coalesce(sum(grand_total), 0)::float8 AS revenue
      FROM (
        SELECT DISTINCT ON (o.id) o.id, o.grand_total, coalesce(p.provider::text, 'OTHER') AS provider
        FROM orders o LEFT JOIN payments p ON p.order_id = o.id
        WHERE o.store_id = ${storeId}::uuid AND o.created_at >= ${utc(w.start)} AND o.created_at < ${utc(w.end)} AND ${SALE}
        ORDER BY o.id, p.attempt_number DESC NULLS LAST
      ) latest
      GROUP BY 1 ORDER BY 2 DESC`;
    return rows.map((row) => ({ provider: row.provider, orders: n(row.orders), revenue: money(n(row.revenue)) }));
  }

  /**
   * Shoppers who bought in the range: their first order ever is in the range
   * (new) or before it (returning). Guest orders are matched by the phone
   * number (last 10 digits), or the email when there is no phone.
   */
  private async customers(storeId: string, w: Window) {
    const [row] = await this.prisma.$queryRaw<{ new: number; returning: number }[]>`
      WITH keyed AS (
        SELECT o.created_at,
               coalesce(o.customer_id::text,
                        nullif(right(regexp_replace(coalesce(a.phone, ''), '[^0-9]', '', 'g'), 10), ''),
                        lower(a.email::text)) AS buyer
        FROM orders o
        LEFT JOIN LATERAL (
          SELECT x.phone, x.email FROM order_addresses x
          WHERE x.order_id = o.id ORDER BY (x.type = 'SHIPPING') DESC LIMIT 1
        ) a ON true
        WHERE o.store_id = ${storeId}::uuid AND o.created_at < ${utc(w.end)} AND ${SALE}
      ), buyers AS (
        SELECT buyer, min(created_at) AS first_at, bool_or(created_at >= ${utc(w.start)}) AS in_range
        FROM keyed WHERE buyer IS NOT NULL GROUP BY buyer
      )
      SELECT (count(*) FILTER (WHERE in_range AND first_at >= ${utc(w.start)}))::int AS new,
             (count(*) FILTER (WHERE in_range AND first_at < ${utc(w.start)}))::int AS returning
      FROM buyers`;
    return { new: n(row?.new), returning: n(row?.returning) };
  }
}
