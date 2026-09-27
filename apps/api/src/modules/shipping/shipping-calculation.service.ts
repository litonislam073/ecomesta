import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  Prisma,
  ShippingMethodType,
  type ShippingMethod,
  type ShippingZone,
} from '@prisma/client';
import { moneyToString, parseMoney } from '../../common/utils/catalog.util';
import { PrismaService } from '../../prisma/prisma.service';

export type ShippingCalcItem = {
  productId: string;
  variantId?: string | null;
  quantity: number;
};

export type ShippingLocationInput = {
  divisionId?: string | null;
  districtId?: string | null;
  upazilaId?: string | null;
};

export type CalculateShippingInput = {
  storeId: string;
  shippingMethodId: string;
  items: ShippingCalcItem[];
  /** Bangladesh location IDs for zone resolution (Phase 20). */
  location?: ShippingLocationInput;
  /** Legacy free-form address (Phase 11); unused for zone matching. */
  address?: {
    country?: string;
    state?: string | null;
    postalCode?: string | null;
    city?: string;
  };
  /** Subtotal after discount for free-shipping threshold (server-computed). */
  orderSubtotalAfterDiscount?: Prisma.Decimal | string | number | null;
  /** When true, method must be active (public checkout). Default true. */
  requireActive?: boolean;
  /** When true (COD), method.codAllowed must be true. */
  requireCodAllowed?: boolean;
};

export type CalculateShippingResult = {
  shippingMethodId: string;
  name: string;
  type: ShippingMethodType;
  provider: string;
  amount: Prisma.Decimal;
  amountString: string;
  zoneId: string | null;
  zoneName: string | null;
  codAllowed: boolean;
  estimatedDelivery: string | null;
  freeShippingApplied: boolean;
  freeShippingThreshold: string | null;
};

export type QuotedShippingMethod = {
  id: string;
  name: string;
  type: ShippingMethodType;
  provider: string;
  price: string;
  amount: string;
  freeShippingApplied: boolean;
  freeShippingThreshold: string | null;
  codAllowed: boolean;
  estimatedDelivery: string | null;
  sortOrder: number;
  zoneId: string | null;
  description: string | null;
};

export type ShippingQuoteResult = {
  zone: { id: string; name: string; priority: number } | null;
  subtotalAfterDiscount: string;
  methods: QuotedShippingMethod[];
};

/**
 * Phase 11 + Phase 20 shipping calculation.
 *
 * Zone resolution:
 * 1. Match active ShippingZoneLocation rows for the store against checkout location
 * 2. Among matching active zones, highest `priority` wins
 * 3. Tie-break: newer `updatedAt`, then `name` ascending
 * 4. If a zone matches → active methods with that zoneId
 * 5. If no zone → active methods with zoneId null (Phase 11 legacy / store-wide)
 *
 * Pricing:
 * - FREE → 0
 * - FLAT / EXTERNAL → configured price
 * - WEIGHT_BASED → sum(weight * rate) when variant weights + configuration.ratePerUnit
 *   exist; otherwise configured price
 * - freeShippingThreshold: if subtotalAfterDiscount >= threshold → 0
 */
@Injectable()
export class ShippingCalculationService {
  constructor(private readonly prisma: PrismaService) {}

  async calculate(
    input: CalculateShippingInput,
  ): Promise<CalculateShippingResult> {
    if (!input.items?.length) {
      throw new UnprocessableEntityException(
        'At least one item is required to calculate shipping',
      );
    }

    const method = await this.prisma.shippingMethod.findFirst({
      where: { id: input.shippingMethodId, storeId: input.storeId },
      include: { zone: true },
    });
    if (!method) {
      throw new NotFoundException(
        'Shipping method not found for this store',
      );
    }
    if (input.requireActive !== false && !method.active) {
      throw new UnprocessableEntityException(
        'Shipping method is not active',
      );
    }
    if (input.requireCodAllowed && !method.codAllowed) {
      throw new UnprocessableEntityException(
        'Cash on delivery is not allowed for this shipping method',
      );
    }

    await this.assertItemsBelongToStore(input.storeId, input.items);

    const resolvedZone = await this.resolveZone(
      input.storeId,
      input.location ?? {},
    );

    // Method must be available for the resolved zone (or store-wide when no zone).
    this.assertMethodAvailableForZone(method, resolvedZone);

    const subtotalAfterDiscount = this.toDecimal(
      input.orderSubtotalAfterDiscount ?? 0,
    );

    const priced = await this.priceMethod(
      method,
      input.items,
      subtotalAfterDiscount,
    );

    return {
      shippingMethodId: method.id,
      name: method.name,
      type: method.type,
      provider: method.provider,
      amount: priced.amount,
      amountString: moneyToString(priced.amount)!,
      zoneId: resolvedZone?.id ?? method.zoneId ?? null,
      zoneName: resolvedZone?.name ?? method.zone?.name ?? null,
      codAllowed: method.codAllowed,
      estimatedDelivery: method.estimatedDelivery,
      freeShippingApplied: priced.freeShippingApplied,
      freeShippingThreshold: method.freeShippingThreshold
        ? moneyToString(method.freeShippingThreshold)
        : null,
    };
  }

  /**
   * List available methods for a location with server-computed prices.
   */
  async quote(params: {
    storeId: string;
    location: ShippingLocationInput;
    items: ShippingCalcItem[];
    orderSubtotalAfterDiscount: Prisma.Decimal | string | number;
  }): Promise<ShippingQuoteResult> {
    if (!params.items?.length) {
      throw new UnprocessableEntityException(
        'At least one item is required to quote shipping',
      );
    }
    await this.assertItemsBelongToStore(params.storeId, params.items);

    const zone = await this.resolveZone(params.storeId, params.location);
    const subtotalAfterDiscount = this.toDecimal(
      params.orderSubtotalAfterDiscount,
    );

    const methods = await this.prisma.shippingMethod.findMany({
      where: {
        storeId: params.storeId,
        active: true,
        ...(zone
          ? { zoneId: zone.id }
          : { zoneId: null }),
      },
      orderBy: [{ sortOrder: 'asc' }, { price: 'asc' }, { name: 'asc' }],
    });

    const quoted: QuotedShippingMethod[] = [];
    for (const method of methods) {
      const priced = await this.priceMethod(
        method,
        params.items,
        subtotalAfterDiscount,
      );
      const config = method.configuration as Record<string, unknown> | null;
      const description =
        typeof config?.description === 'string' ? config.description : null;
      quoted.push({
        id: method.id,
        name: method.name,
        type: method.type,
        provider: method.provider,
        price: moneyToString(method.price)!,
        amount: moneyToString(priced.amount)!,
        freeShippingApplied: priced.freeShippingApplied,
        freeShippingThreshold: method.freeShippingThreshold
          ? moneyToString(method.freeShippingThreshold)
          : null,
        codAllowed: method.codAllowed,
        estimatedDelivery: method.estimatedDelivery,
        sortOrder: method.sortOrder,
        zoneId: method.zoneId,
        description,
      });
    }

    return {
      zone: zone
        ? { id: zone.id, name: zone.name, priority: zone.priority }
        : null,
      subtotalAfterDiscount: moneyToString(subtotalAfterDiscount)!,
      methods: quoted,
    };
  }

  async resolveZone(
    storeId: string,
    location: ShippingLocationInput,
  ): Promise<ShippingZone | null> {
    const divisionId = location.divisionId || null;
    const districtId = location.districtId || null;
    const upazilaId = location.upazilaId || null;

    if (!divisionId && !districtId && !upazilaId) {
      return null;
    }

    const locations = await this.prisma.shippingZoneLocation.findMany({
      where: {
        storeId,
        zone: { storeId, active: true },
        OR: [
          ...(upazilaId ? [{ upazilaId }] : []),
          ...(districtId
            ? [{ districtId, upazilaId: null }]
            : []),
          ...(divisionId
            ? [{ divisionId, districtId: null, upazilaId: null }]
            : []),
        ],
      },
      include: { zone: true },
    });

    const matchingZones = new Map<string, ShippingZone>();
    for (const row of locations) {
      if (!this.locationMatches(row, { divisionId, districtId, upazilaId })) {
        continue;
      }
      if (row.zone.active) {
        matchingZones.set(row.zone.id, row.zone);
      }
    }

    if (matchingZones.size === 0) {
      return null;
    }

    const sorted = [...matchingZones.values()].sort((a, b) => {
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      const byUpdated =
        b.updatedAt.getTime() - a.updatedAt.getTime();
      if (byUpdated !== 0) {
        return byUpdated;
      }
      return a.name.localeCompare(b.name);
    });

    return sorted[0] ?? null;
  }

  /**
   * Matching semantics (most specific mapping wins within a row):
   * - mapping.upazilaId set → must equal checkout upazilaId
   * - else mapping.districtId set → must equal checkout districtId
   * - else mapping.divisionId set → must equal checkout divisionId
   */
  locationMatches(
    mapping: {
      divisionId: string | null;
      districtId: string | null;
      upazilaId: string | null;
    },
    checkout: {
      divisionId: string | null;
      districtId: string | null;
      upazilaId: string | null;
    },
  ): boolean {
    if (mapping.upazilaId) {
      return mapping.upazilaId === checkout.upazilaId;
    }
    if (mapping.districtId) {
      return mapping.districtId === checkout.districtId;
    }
    if (mapping.divisionId) {
      return mapping.divisionId === checkout.divisionId;
    }
    return false;
  }

  amountForType(
    type: ShippingMethodType,
    configuredPrice: Prisma.Decimal,
  ): Prisma.Decimal {
    if (type === ShippingMethodType.FREE) {
      return new Prisma.Decimal(0);
    }
    return configuredPrice;
  }

  private assertMethodAvailableForZone(
    method: ShippingMethod & { zone: ShippingZone | null },
    resolvedZone: ShippingZone | null,
  ) {
    if (resolvedZone) {
      if (method.zoneId !== resolvedZone.id) {
        throw new UnprocessableEntityException(
          'Shipping method is not available for this delivery location',
        );
      }
      return;
    }
    // No zone match → only store-wide (zoneId null) methods.
    if (method.zoneId) {
      throw new UnprocessableEntityException(
        'Shipping method is not available for this delivery location',
      );
    }
  }

  private async priceMethod(
    method: ShippingMethod,
    items: ShippingCalcItem[],
    subtotalAfterDiscount: Prisma.Decimal,
  ): Promise<{ amount: Prisma.Decimal; freeShippingApplied: boolean }> {
    let amount = await this.amountForMethod(method, items);

    let freeShippingApplied = false;
    if (
      method.freeShippingThreshold &&
      !subtotalAfterDiscount.lessThan(method.freeShippingThreshold)
    ) {
      amount = new Prisma.Decimal(0);
      freeShippingApplied = true;
    }

    if (amount.isNegative()) {
      amount = new Prisma.Decimal(0);
    }

    return { amount, freeShippingApplied };
  }

  private async amountForMethod(
    method: ShippingMethod,
    items: ShippingCalcItem[],
  ): Promise<Prisma.Decimal> {
    if (method.type === ShippingMethodType.FREE) {
      return new Prisma.Decimal(0);
    }

    if (method.type === ShippingMethodType.WEIGHT_BASED) {
      const config = method.configuration as Record<string, unknown> | null;
      const rateRaw =
        config?.ratePerUnit ?? config?.ratePerKg ?? config?.weightRate;
      if (typeof rateRaw === 'string' || typeof rateRaw === 'number') {
        const rate = parseMoney(String(rateRaw), 'weightRate');
        const totalWeight = await this.sumItemWeights(method.storeId, items);
        if (totalWeight !== null) {
          return totalWeight.mul(rate).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
        }
      }
      // Fall back to configured price when weights or rate unavailable.
      return method.price;
    }

    // FLAT, EXTERNAL
    return method.price;
  }

  /**
   * Sum variant weights * qty when every line has a resolvable weight.
   * Returns null if any line lacks weight (do not invent).
   */
  private async sumItemWeights(
    storeId: string,
    items: ShippingCalcItem[],
  ): Promise<Prisma.Decimal | null> {
    let total = new Prisma.Decimal(0);
    for (const item of items) {
      if (!item.variantId) {
        return null;
      }
      const variant = await this.prisma.productVariant.findFirst({
        where: {
          id: item.variantId,
          productId: item.productId,
          storeId,
        },
        select: { weight: true },
      });
      if (!variant?.weight) {
        return null;
      }
      total = total.add(variant.weight.mul(item.quantity));
    }
    return total;
  }

  private toDecimal(
    value: Prisma.Decimal | string | number | null | undefined,
  ): Prisma.Decimal {
    if (value instanceof Prisma.Decimal) {
      return value;
    }
    if (value === null || value === undefined || value === '') {
      return new Prisma.Decimal(0);
    }
    return parseMoney(String(value), 'orderSubtotalAfterDiscount');
  }

  private async assertItemsBelongToStore(
    storeId: string,
    items: ShippingCalcItem[],
  ) {
    for (const item of items) {
      const product = await this.prisma.product.findFirst({
        where: { id: item.productId, storeId },
        select: { id: true },
      });
      if (!product) {
        throw new NotFoundException(
          `Product ${item.productId} not found in this store`,
        );
      }
      if (item.variantId) {
        const variant = await this.prisma.productVariant.findFirst({
          where: {
            id: item.variantId,
            productId: item.productId,
            storeId,
          },
          select: { id: true },
        });
        if (!variant) {
          throw new NotFoundException(
            `Variant ${item.variantId} not found in this store`,
          );
        }
      }
    }
  }
}
