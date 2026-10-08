import { Prisma, ShippingMethodType } from '@prisma/client';

/** Ready-made delivery charges for a new store; the merchant edits or deletes them like any other. */
export const DEFAULT_SHIPPING = {
  dhaka: { name: 'Dhaka City', price: '60.00', freeShippingThreshold: '2000.00', estimatedDelivery: '1–2 days' },
  outside: { name: 'Outside Dhaka', price: '120.00', freeShippingThreshold: '3000.00', estimatedDelivery: '3–5 days' },
} as const;

/**
 * Creates the starter shipping setup for a new store, inside the transaction
 * that creates it.
 *
 * - With delivery zones in the plan (Growth, Business): a "Dhaka City" zone
 *   (Dhaka district, checked first) and an "Outside Dhaka" zone (every
 *   division), each with its home-delivery method.
 * - Without (Starter), or when the Bangladesh location list is not loaded:
 *   two store-wide methods, "Inside Dhaka" and "Outside Dhaka", that the
 *   customer chooses between at checkout. Zones are a paid feature, so none are
 *   created for a plan that cannot use them.
 */
export async function createDefaultShipping(
  tx: Prisma.TransactionClient,
  storeId: string,
  options: { zones: boolean },
): Promise<void> {
  const { dhaka, outside } = DEFAULT_SHIPPING;
  const method = (name: string, rate: typeof dhaka | typeof outside, sortOrder: number, zoneId: string | null) => ({
    storeId,
    name,
    type: ShippingMethodType.FLAT,
    price: new Prisma.Decimal(rate.price),
    freeShippingThreshold: new Prisma.Decimal(rate.freeShippingThreshold),
    estimatedDelivery: rate.estimatedDelivery,
    codAllowed: true,
    active: true,
    sortOrder,
    zoneId,
  });

  if (options.zones) {
    const [dhakaDistrict, divisions] = await Promise.all([
      tx.bdDistrict.findFirst({ where: { code: 'DHAKA_DHAKA' }, select: { id: true } }),
      tx.bdDivision.findMany({ select: { id: true } }),
    ]);
    if (dhakaDistrict && divisions.length > 0) {
      const dhakaZone = await tx.shippingZone.create({
        data: { storeId, name: dhaka.name, priority: 10, active: true },
      });
      await tx.shippingZoneLocation.create({
        data: { zoneId: dhakaZone.id, storeId, districtId: dhakaDistrict.id },
      });
      const outsideZone = await tx.shippingZone.create({
        data: { storeId, name: outside.name, priority: 0, active: true },
      });
      await tx.shippingZoneLocation.createMany({
        data: divisions.map((division) => ({ zoneId: outsideZone.id, storeId, divisionId: division.id })),
      });
      await tx.shippingMethod.createMany({
        data: [
          method('Home delivery — Dhaka City', dhaka, 0, dhakaZone.id),
          method('Home delivery — Outside Dhaka', outside, 1, outsideZone.id),
        ],
      });
      return;
    }
  }

  await tx.shippingMethod.createMany({
    data: [method('Inside Dhaka', dhaka, 0, null), method('Outside Dhaka', outside, 1, null)],
  });
}
