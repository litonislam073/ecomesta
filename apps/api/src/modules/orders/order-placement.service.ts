import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  CustomerAddressType,
  FulfillmentStatus,
  InventoryMovementType,
  OrderStatus,
  PaymentMethod,
  PaymentProvider,
  PaymentStatus,
  Prisma,
  ProductStatus,
  ShippingMethodType,
} from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { moneyToString, parseMoney } from '../../common/utils/catalog.util';
import { PrismaService } from '../../prisma/prisma.service';
import { CouponValidationService } from '../coupons/coupon-validation.service';
import type { CouponDiscountResult } from '../coupons/coupon-math';
import { generatePaymentInternalReference } from '../payments/payment-reference.util';
import { OrderAddressInputDto } from './dto/order.dto';

export type PlaceOrderItemInput = {
  productId: string;
  variantId?: string | null;
  quantity: number;
};

export type PlaceOrderParams = {
  storeId: string;
  items: PlaceOrderItemInput[];
  shippingAddress?: OrderAddressInputDto;
  billingAddress?: OrderAddressInputDto | null;
  shippingAddressId?: string;
  billingAddressId?: string;
  customerId?: string | null;
  /** Ignored when couponCode is set or requireActiveCatalog (public checkout). */
  discountTotal?: string | number;
  /** Server-validated coupon code; discount computed from live catalog subtotal. */
  couponCode?: string | null;
  shippingTotal?: string | number;
  /** Snapshot fields captured at purchase; optional for merchant-created orders. */
  shippingMethodName?: string | null;
  shippingMethodType?: ShippingMethodType | null;
  shippingZoneName?: string | null;
  customerNote?: string | null;
  internalNote?: string | null;
  paymentProvider: PaymentProvider;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  /** When true, only ProductStatus.ACTIVE catalog rows may be ordered. */
  requireActiveCatalog: boolean;
  idempotencyKey?: string | null;
  generatePublicReference: boolean;
  /**
   * Grand total the customer was shown (public checkout quote). When set and
   * the server total differs, placement is refused before anything is written.
   */
  expectedGrandTotal?: Prisma.Decimal | null;
};

export const CHECKOUT_TOTAL_CHANGED = 'CHECKOUT_TOTAL_CHANGED';

type LockedInventory = {
  id: string;
  quantity: number;
  reserved_quantity: number;
};

type NormalizedAddress = {
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string | null;
  postalCode: string | null;
  country: string;
  phone: string | null;
  email: string | null;
  divisionId: string | null;
  districtId: string | null;
  upazilaId: string | null;
  divisionName: string | null;
  districtName: string | null;
  upazilaName: string | null;
  landmark: string | null;
};

const detailInclude = {
  customer: {
    select: {
      id: true,
      email: true,
      phone: true,
      firstName: true,
      lastName: true,
    },
  },
  items: { orderBy: { createdAt: 'asc' as const } },
  addresses: true,
  payments: { orderBy: { createdAt: 'desc' as const } },
  shipments: { orderBy: { createdAt: 'desc' as const } },
};

export type PlacedOrder = Prisma.OrderGetPayload<{ include: typeof detailInclude }>;

@Injectable()
export class OrderPlacementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly couponValidation: CouponValidationService,
  ) {}

  async findByIdempotencyKey(
    storeId: string,
    idempotencyKey: string,
  ): Promise<PlacedOrder | null> {
    return this.prisma.order.findFirst({
      where: { storeId, idempotencyKey },
      include: detailInclude,
    });
  }

  async findByPublicReference(
    storeId: string,
    publicReference: string,
  ): Promise<PlacedOrder | null> {
    return this.prisma.order.findFirst({
      where: { storeId, publicReference },
      include: detailInclude,
    });
  }

  /**
   * Shared order placement used by merchant create and public checkout.
   * Prices and inventory are always loaded from the database inside a transaction.
   */
  async place(params: PlaceOrderParams): Promise<{
    order: PlacedOrder;
    tenantId: string;
    replayed: boolean;
    appliedCoupon?: CouponDiscountResult | null;
  }> {
    if (!params.items?.length) {
      throw new BadRequestException('At least one order item is required');
    }

    if (params.idempotencyKey) {
      const existing = await this.findByIdempotencyKey(
        params.storeId,
        params.idempotencyKey,
      );
      if (existing) {
        const store = await this.prisma.store.findUnique({
          where: { id: params.storeId },
          select: { tenantId: true },
        });
        return {
          order: existing,
          tenantId: store?.tenantId ?? '',
          replayed: true,
        };
      }
    }

    const shippingTotal = parseMoney(params.shippingTotal ?? '0', 'shippingTotal');
    // Public checkout never trusts client discount; merchant may pass manual discountTotal
    // unless a couponCode is provided (coupon always wins).
    let discountTotal = params.requireActiveCatalog
      ? new Prisma.Decimal(0)
      : parseMoney(params.discountTotal ?? '0', 'discountTotal');

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        if (params.idempotencyKey) {
          const raced = await tx.order.findFirst({
            where: {
              storeId: params.storeId,
              idempotencyKey: params.idempotencyKey,
            },
            include: detailInclude,
          });
          if (raced) {
            return {
              order: raced,
              tenantId: '',
              replayed: true as const,
              appliedCoupon: null,
            };
          }
        }

        const storeRows = await tx.$queryRaw<
          {
            id: string;
            tenant_id: string;
            currency: string;
            order_sequence: number;
          }[]
        >`
          UPDATE stores
          SET order_sequence = order_sequence + 1
          WHERE id = ${params.storeId}::uuid
          RETURNING id, tenant_id, currency, order_sequence
        `;
        const store = storeRows[0];
        if (!store) {
          throw new NotFoundException('Store not found');
        }

        const orderNumber = `EM-${store.order_sequence}`;
        const publicReference = params.generatePublicReference
          ? randomBytes(24).toString('base64url')
          : null;

        let customerId: string | null = null;
        if (params.customerId) {
          const customer = await tx.customer.findFirst({
            where: { id: params.customerId, storeId: params.storeId },
            select: { id: true },
          });
          if (!customer) {
            throw new NotFoundException('Customer not found in this store');
          }
          customerId = customer.id;
        }

        const shippingSnapshot = await this.resolveAddressSnapshot(
          tx,
          params.storeId,
          customerId,
          params.shippingAddressId,
          params.shippingAddress,
          'shipping',
        );
        if (!shippingSnapshot) {
          throw new BadRequestException(
            'shippingAddress or shippingAddressId is required',
          );
        }
        const billingResolved = await this.resolveAddressSnapshot(
          tx,
          params.storeId,
          customerId,
          params.billingAddressId,
          params.billingAddress ?? undefined,
          'billing',
          true,
        );
        const billingSnapshot = billingResolved ?? shippingSnapshot;

        type PreparedLine = {
          productId: string;
          variantId: string | null;
          productName: string;
          variantName: string | null;
          sku: string | null;
          quantity: number;
          unitPrice: Prisma.Decimal;
          totalPrice: Prisma.Decimal;
          trackInventory: boolean;
          allowBackorder: boolean;
        };

        const prepared: PreparedLine[] = [];
        let subtotal = new Prisma.Decimal(0);

        for (const line of params.items) {
          const product = await tx.product.findFirst({
            where: { id: line.productId, storeId: params.storeId },
            select: {
              id: true,
              name: true,
              sku: true,
              basePrice: true,
              status: true,
              trackInventory: true,
              allowBackorder: true,
              _count: { select: { variants: true } },
            },
          });
          if (!product) {
            throw new NotFoundException(
              `Product ${line.productId} not found in this store`,
            );
          }
          if (product.status === ProductStatus.ARCHIVED) {
            throw new UnprocessableEntityException(
              `Product "${product.name}" is archived and cannot be ordered`,
            );
          }
          if (
            params.requireActiveCatalog &&
            product.status !== ProductStatus.ACTIVE
          ) {
            throw new UnprocessableEntityException(
              `Product "${product.name}" is not available for purchase`,
            );
          }

          const variantId: string | null = line.variantId ?? null;
          let variantName: string | null = null;
          let sku = product.sku;
          let unitPrice = product.basePrice;

          if (product._count.variants > 0) {
            if (!variantId) {
              throw new BadRequestException(
                `variantId is required for product "${product.name}"`,
              );
            }
            const variant = await tx.productVariant.findFirst({
              where: {
                id: variantId,
                productId: product.id,
                storeId: params.storeId,
              },
              select: {
                id: true,
                name: true,
                sku: true,
                price: true,
                status: true,
              },
            });
            if (!variant) {
              throw new NotFoundException(
                `Variant ${variantId} not found for product in this store`,
              );
            }
            if (variant.status === ProductStatus.ARCHIVED) {
              throw new UnprocessableEntityException(
                `Variant "${variant.name}" is archived and cannot be ordered`,
              );
            }
            if (
              params.requireActiveCatalog &&
              variant.status !== ProductStatus.ACTIVE
            ) {
              throw new UnprocessableEntityException(
                `Variant "${variant.name}" is not available for purchase`,
              );
            }
            variantName = variant.name;
            sku = variant.sku ?? product.sku;
            unitPrice = variant.price;
          } else if (variantId) {
            throw new BadRequestException(
              `Product "${product.name}" has no variants; omit variantId`,
            );
          }

          const totalPrice = unitPrice.mul(line.quantity);
          subtotal = subtotal.add(totalPrice);
          prepared.push({
            productId: product.id,
            variantId,
            productName: product.name,
            variantName,
            sku,
            quantity: line.quantity,
            unitPrice,
            totalPrice,
            trackInventory: product.trackInventory,
            allowBackorder: product.allowBackorder,
          });
        }

        let appliedCoupon: CouponDiscountResult | null = null;
        if (params.couponCode?.trim()) {
          appliedCoupon = await this.couponValidation.lockAndValidate(tx, {
            storeId: params.storeId,
            code: params.couponCode,
            subtotal,
            identity: {
              customerId,
              email:
                shippingSnapshot.email ??
                billingSnapshot.email ??
                null,
            },
          });
          discountTotal = appliedCoupon.discount;
        }

        const taxTotal = new Prisma.Decimal(0);
        const grandTotal = subtotal
          .sub(discountTotal)
          .add(shippingTotal)
          .add(taxTotal);
        if (grandTotal.isNegative()) {
          throw new BadRequestException(
            'grandTotal cannot be negative; reduce discountTotal',
          );
        }
        // SF-03: never charge a total the customer did not see. Throwing here
        // rolls back the order sequence; no inventory, coupon or payment is touched.
        if (
          params.expectedGrandTotal &&
          !grandTotal.equals(params.expectedGrandTotal)
        ) {
          throw new ConflictException({
            message:
              'Prices or shipping changed since you reviewed your order. Please check the updated total and place your order again.',
            error: CHECKOUT_TOTAL_CHANGED,
          });
        }

        const inventoryKeys = prepared
          .filter((p) => p.trackInventory)
          .map((p) => ({
            productId: p.productId,
            variantId: p.variantId,
            quantity: p.quantity,
            allowBackorder: p.allowBackorder,
            label: p.variantName
              ? `${p.productName} / ${p.variantName}`
              : p.productName,
          }))
          .sort((a, b) =>
            `${a.productId}:${a.variantId ?? ''}`.localeCompare(
              `${b.productId}:${b.variantId ?? ''}`,
            ),
          );

        const merged = new Map<
          string,
          {
            productId: string;
            variantId: string | null;
            quantity: number;
            allowBackorder: boolean;
            label: string;
          }
        >();
        for (const key of inventoryKeys) {
          const id = `${key.productId}:${key.variantId ?? 'null'}`;
          const existing = merged.get(id);
          if (existing) {
            existing.quantity += key.quantity;
          } else {
            merged.set(id, { ...key });
          }
        }

        for (const need of merged.values()) {
          let row = await this.lockInventoryRow(
            tx,
            params.storeId,
            need.productId,
            need.variantId,
          );
          if (!row) {
            const created = await tx.inventoryItem.create({
              data: {
                storeId: params.storeId,
                productId: need.productId,
                variantId: need.variantId,
                quantity: 0,
                reservedQuantity: 0,
              },
            });
            row = await this.lockInventoryRow(
              tx,
              params.storeId,
              need.productId,
              need.variantId,
            );
            if (!row) {
              row = {
                id: created.id,
                quantity: 0,
                reserved_quantity: 0,
              };
            }
          }

          const available = row.quantity - row.reserved_quantity;
          if (available < need.quantity && !need.allowBackorder) {
            throw new UnprocessableEntityException(
              `Insufficient stock for ${need.label}. Available: ${Math.max(0, available)}, requested: ${need.quantity}`,
            );
          }
          const nextQuantity = row.quantity - need.quantity;
          if (nextQuantity < 0 && !need.allowBackorder) {
            throw new UnprocessableEntityException(
              `Insufficient stock for ${need.label}`,
            );
          }
          if (row.reserved_quantity > nextQuantity && !need.allowBackorder) {
            throw new UnprocessableEntityException(
              `Cannot fulfill ${need.label}: reserved stock would exceed on-hand after sale`,
            );
          }

          await tx.inventoryItem.update({
            where: { id: row.id },
            data: { quantity: nextQuantity },
          });
        }

        const order = await tx.order.create({
          data: {
            storeId: params.storeId,
            customerId,
            orderNumber,
            publicReference,
            idempotencyKey: params.idempotencyKey ?? null,
            status: OrderStatus.PENDING,
            paymentStatus: params.paymentStatus,
            fulfillmentStatus: FulfillmentStatus.UNFULFILLED,
            currency: store.currency,
            subtotal,
            discountTotal,
            shippingTotal,
            taxTotal,
            grandTotal,
            shippingMethodName: params.shippingMethodName?.trim() || null,
            shippingMethodType: params.shippingMethodType ?? null,
            shippingZoneName: params.shippingZoneName?.trim() || null,
            couponCode: appliedCoupon?.code ?? null,
            customerNote: params.customerNote?.trim() || null,
            internalNote: params.internalNote?.trim() || null,
            items: {
              create: prepared.map((line) => ({
                productId: line.productId,
                variantId: line.variantId,
                productName: line.productName,
                variantName: line.variantName,
                sku: line.sku,
                quantity: line.quantity,
                unitPrice: line.unitPrice,
                totalPrice: line.totalPrice,
              })),
            },
            addresses: {
              create: [
                {
                  type: CustomerAddressType.SHIPPING,
                  ...this.toAddressCreate(shippingSnapshot),
                },
                {
                  type: CustomerAddressType.BILLING,
                  ...this.toAddressCreate(billingSnapshot),
                },
              ],
            },
            payments: {
              create: {
                storeId: params.storeId,
                provider: params.paymentProvider,
                amount: grandTotal,
                currency: store.currency,
                status: params.paymentStatus,
                method: params.paymentMethod,
                internalReference: generatePaymentInternalReference(),
                attemptNumber: 1,
              },
            },
          },
          include: detailInclude,
        });

        for (const need of merged.values()) {
          await tx.inventoryMovement.create({
            data: {
              storeId: params.storeId,
              productId: need.productId,
              variantId: need.variantId,
              type: InventoryMovementType.SALE,
              quantity: -need.quantity,
              referenceType: 'ORDER',
              referenceId: order.id,
              note: `Order ${orderNumber}`,
            },
          });
        }

        if (appliedCoupon) {
          await tx.couponUsage.create({
            data: {
              couponId: appliedCoupon.coupon.id,
              orderId: order.id,
              customerId,
              discountAmount: appliedCoupon.discount,
            },
          });
          await tx.coupon.update({
            where: { id: appliedCoupon.coupon.id },
            data: { usageCount: { increment: 1 } },
          });
        }

        return {
          order,
          tenantId: store.tenant_id,
          replayed: false as const,
          appliedCoupon,
        };
      });

      if (result.replayed && !result.tenantId) {
        const store = await this.prisma.store.findUnique({
          where: { id: params.storeId },
          select: { tenantId: true },
        });
        return {
          order: result.order,
          tenantId: store?.tenantId ?? '',
          replayed: true,
        };
      }

      return result;
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002' &&
        params.idempotencyKey
      ) {
        const existing = await this.findByIdempotencyKey(
          params.storeId,
          params.idempotencyKey,
        );
        if (existing) {
          const store = await this.prisma.store.findUnique({
            where: { id: params.storeId },
            select: { tenantId: true },
          });
          return {
            order: existing,
            tenantId: store?.tenantId ?? '',
            replayed: true,
          };
        }
      }
      throw err;
    }
  }

  moneyString(value: Prisma.Decimal): string {
    return moneyToString(value)!;
  }

  private async resolveAddressSnapshot(
    tx: Prisma.TransactionClient,
    storeId: string,
    customerId: string | null,
    addressId: string | undefined,
    inline: OrderAddressInputDto | undefined,
    label: string,
    optional = false,
  ): Promise<NormalizedAddress | null> {
    if (addressId) {
      if (!customerId) {
        throw new BadRequestException(`${label}AddressId requires customerId`);
      }
      const address = await tx.customerAddress.findFirst({
        where: {
          id: addressId,
          customerId,
          customer: { storeId },
        },
      });
      if (!address) {
        throw new NotFoundException(
          `${label} address not found for this store customer`,
        );
      }
      return {
        firstName: address.firstName,
        lastName: address.lastName,
        company: address.company,
        addressLine1: address.addressLine1,
        addressLine2: address.addressLine2,
        city: address.city,
        state: address.state,
        postalCode: address.postalCode,
        country: address.country.toUpperCase(),
        phone: address.phone,
        email: null,
        divisionId: address.divisionId,
        districtId: address.districtId,
        upazilaId: address.upazilaId,
        divisionName: null,
        districtName: null,
        upazilaName: null,
        landmark: address.landmark,
      };
    }

    if (inline) {
      return this.normalizeInlineAddress(inline);
    }

    if (optional) {
      return null;
    }

    throw new BadRequestException(
      `${label}Address or ${label}AddressId is required`,
    );
  }

  private normalizeInlineAddress(input: OrderAddressInputDto): NormalizedAddress {
    let firstName = input.firstName?.trim() || null;
    let lastName = input.lastName?.trim() || null;
    if (!firstName && input.name?.trim()) {
      const parts = input.name.trim().split(/\s+/);
      firstName = parts[0] ?? null;
      lastName = parts.slice(1).join(' ') || null;
    }
    return {
      firstName,
      lastName,
      company: input.company?.trim() || null,
      addressLine1: input.addressLine1.trim(),
      addressLine2: input.addressLine2?.trim() || null,
      city: input.city.trim(),
      state: input.state?.trim() || null,
      postalCode: input.postalCode?.trim() || null,
      country: input.country.trim().toUpperCase(),
      phone: input.phone?.trim() || null,
      email: input.email?.trim().toLowerCase() || null,
      divisionId: input.divisionId ?? null,
      districtId: input.districtId ?? null,
      upazilaId: input.upazilaId ?? null,
      divisionName: input.divisionName?.trim() || null,
      districtName: input.districtName?.trim() || null,
      upazilaName: input.upazilaName?.trim() || null,
      landmark: input.landmark?.trim() || null,
    };
  }

  private toAddressCreate(address: NormalizedAddress) {
    return {
      firstName: address.firstName,
      lastName: address.lastName,
      company: address.company,
      addressLine1: address.addressLine1,
      addressLine2: address.addressLine2,
      city: address.city,
      state: address.state,
      postalCode: address.postalCode,
      country: address.country,
      phone: address.phone,
      email: address.email,
      divisionId: address.divisionId,
      districtId: address.districtId,
      upazilaId: address.upazilaId,
      divisionName: address.divisionName,
      districtName: address.districtName,
      upazilaName: address.upazilaName,
      landmark: address.landmark,
    };
  }

  private async lockInventoryRow(
    tx: Prisma.TransactionClient,
    storeId: string,
    productId: string,
    variantId: string | null,
  ): Promise<LockedInventory | null> {
    if (variantId) {
      const rows = await tx.$queryRaw<LockedInventory[]>`
        SELECT id, quantity, reserved_quantity
        FROM inventory_items
        WHERE store_id = ${storeId}::uuid
          AND product_id = ${productId}::uuid
          AND variant_id = ${variantId}::uuid
        FOR UPDATE
      `;
      return rows[0] ?? null;
    }
    const rows = await tx.$queryRaw<LockedInventory[]>`
      SELECT id, quantity, reserved_quantity
      FROM inventory_items
      WHERE store_id = ${storeId}::uuid
        AND product_id = ${productId}::uuid
        AND variant_id IS NULL
      FOR UPDATE
    `;
    return rows[0] ?? null;
  }
}
