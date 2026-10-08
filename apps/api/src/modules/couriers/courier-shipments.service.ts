import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  CustomerAddressType,
  FulfillmentStatus,
  OrderStatus,
  PaymentProvider,
  PaymentStatus,
  Prisma,
  ShipmentStatus,
  StoreRole,
  type Shipment,
} from '@prisma/client';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthorizationService } from '../authorization/authorization.service';
import { CLOSED_SHIPMENT_STATUSES, isShippedLike, syncOrderFulfillment } from '../shipments/shipment-fulfillment';
import { courierFields } from '../shipments/shipments.service';
import { CourierConnectionsService } from './courier-connections.service';
import { courierFailure, CourierUnavailableError } from './courier-errors';
import type { CourierBooking, CourierCredentials, CourierProvider, CourierStatusResult } from './courier-provider';
import { CourierProviderRegistry } from './courier-provider.registry';
import { formatDeliveryAddress, normalizeBdMobile } from './courier-recipient';
import { CreateCourierShipmentDto } from './dto/courier.dto';

const CLOSED = CLOSED_SHIPMENT_STATUSES;
const RANK: Partial<Record<ShipmentStatus, number>> = {
  [ShipmentStatus.PENDING]: 0,
  [ShipmentStatus.LABEL_CREATED]: 1,
  [ShipmentStatus.SHIPPED]: 2,
  [ShipmentStatus.IN_TRANSIT]: 3,
  [ShipmentStatus.DELIVERED]: 4,
};

/**
 * A booking whose create call started this long ago and never finished (the
 * process stopped mid-call) is treated like an unconfirmed one. Well above the
 * 15 s courier HTTP timeout, so a live call is never mistaken for a dead one.
 */
export const BOOKING_STALE_MS = 2 * 60_000;

/**
 * - in_progress: the create call is running (or the process died during it)
 * - unconfirmed: the create call's answer was lost (timeout, 5xx, unreadable)
 * - confirmed: the courier holds the parcel
 * - released: the merchant confirmed the courier never got it (shipment FAILED)
 */
export type BookingState = 'in_progress' | 'unconfirmed' | 'confirmed' | 'released';
export const bookingOf = (s: Pick<Shipment, 'metadata'>): BookingState | null =>
  ((s.metadata as { booking?: BookingState } | null)?.booking ?? null);

/** The courier may hold this parcel but has not confirmed it to us. */
function needsReconciliation(s: Shipment, now = Date.now()): boolean {
  const state = bookingOf(s);
  if (CLOSED.includes(s.status)) return false;
  if (state === 'unconfirmed') return true;
  return state === 'in_progress' && now - s.updatedAt.getTime() > BOOKING_STALE_MS;
}

/**
 * Where a courier-reported status may take a shipment. The courier is the
 * source of truth, but a shipment never moves backwards, never leaves a
 * closed state, and a cancellation after pickup means the parcel came back.
 */
export function courierNextStatus(current: ShipmentStatus, mapped: ShipmentStatus | null): ShipmentStatus | null {
  if (!mapped || mapped === current || CLOSED.includes(current)) return null;
  const rank = RANK[current] ?? 0;
  if (mapped === ShipmentStatus.CANCELLED) return rank >= 2 ? ShipmentStatus.RETURNED : ShipmentStatus.CANCELLED;
  const target = RANK[mapped];
  return target !== undefined && target > rank ? mapped : null;
}

/**
 * Booking a courier parcel for an order, and refreshing its status.
 *
 * Duplicate safety does not rely on the courier: Steadfast accepts a repeated
 * `invoice` (its own README shows two parcels created with one invoice), so a
 * lost answer is NEVER retried with another create call.
 * - The shipment row (with the reference sent as `invoice`) is written under
 *   an order lock before the courier is called; a partial unique index allows
 *   one active courier booking per order, and manual shipments take the same
 *   lock and refuse to coexist with it.
 * - A lost answer (timeout, 5xx, unreadable) leaves the booking `unconfirmed`.
 *   Retrying (Create shipment or Sync status) only asks the courier
 *   (status_by_invoice) whether it has the parcel: if it does, the booking is
 *   recovered; anything else keeps it unconfirmed — no create call is made.
 * - Only the merchant, after checking their courier account, can mark an
 *   unconfirmed booking as not booked ("release"); the next booking then uses
 *   a new reference.
 * - Sync never changes a booking whose create call is still running.
 *
 * Courier status only moves the shipment (and order fulfillment, one way);
 * order status and payment status are never changed here.
 */
@Injectable()
export class CourierShipmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
    private readonly audit: AuditService,
    private readonly registry: CourierProviderRegistry,
    private readonly connections: CourierConnectionsService,
  ) {}

  async create(userId: string, storeId: string, orderId: string, dto: CreateCourierShipmentDto, req?: Request) {
    await this.authorization.assertStoreRole(userId, storeId, [StoreRole.STORE_MANAGER]);
    const provider = this.registry.get(dto.provider);
    const store = await this.prisma.store.findUnique({ where: { id: storeId }, select: { id: true, tenantId: true, slug: true } });
    if (!store) throw new NotFoundException('Store not found');
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, storeId },
      include: { addresses: true, payments: { orderBy: { attemptNumber: 'desc' }, take: 1 } },
    });
    if (!order) throw new NotFoundException('Order not found');
    const connection = await this.requireConnection(storeId, provider);

    if (order.status === OrderStatus.CANCELLED || order.status === OrderStatus.DRAFT || order.status === OrderStatus.COMPLETED) {
      throw notShippable(`A ${order.status.toLowerCase()} order cannot be sent to a courier.`);
    }
    if (order.fulfillmentStatus !== FulfillmentStatus.UNFULFILLED && order.fulfillmentStatus !== FulfillmentStatus.PARTIALLY_FULFILLED) {
      throw notShippable('This order is already fulfilled.');
    }
    const codAmount = codAmountFor(order, order.payments[0]?.provider ?? null);
    const address =
      order.addresses.find((a) => a.type === CustomerAddressType.SHIPPING) ??
      order.addresses.find((a) => a.type === CustomerAddressType.BILLING);
    if (!address) throw notShippable('The order has no delivery address.');
    const recipientName = [address.firstName, address.lastName].filter(Boolean).join(' ').trim() || address.company?.trim() || '';
    if (!recipientName) throw notShippable('The delivery address has no recipient name.');
    const recipientPhone = normalizeBdMobile(address.phone);
    if (!recipientPhone) {
      throw notShippable('The delivery phone number is not a valid Bangladeshi mobile number (01XXXXXXXXX).');
    }
    const recipientAddress = formatDeliveryAddress(address);
    if (!recipientAddress) throw notShippable('The delivery address is empty.');
    const weightKg = dto.weightKg ?? connection.publicConfig.defaultWeightKg ?? null;

    // Reserve the booking under the order lock — or find the unconfirmed one to reconcile.
    const reserved = await this.prisma
      .$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM orders WHERE id = ${orderId}::uuid AND store_id = ${storeId}::uuid FOR UPDATE`;
        const active = await tx.shipment.findMany({ where: { orderId, storeId, status: { notIn: CLOSED } } });
        const pending = active.find((s) => s.providerReference && s.provider === provider.code && needsReconciliation(s));
        if (pending) return { mode: 'reconcile' as const, shipment: pending };
        if (active.length > 0) {
          const busy = active.find((s) => bookingOf(s) === 'in_progress');
          const courier = active.find((s) => s.providerReference);
          throw new ConflictException({
            message: busy
              ? 'A courier booking for this order is already in progress.'
              : courier
                ? 'This order already has an active courier shipment.'
                : 'This order already has an active shipment.',
            error: 'SHIPMENT_ALREADY_EXISTS',
          });
        }
        const attempts = await tx.shipment.count({ where: { orderId, storeId, providerReference: { not: null } } });
        const reference = `${store.slug}-${order.orderNumber}${attempts > 0 ? `-${attempts + 1}` : ''}`;
        const created = await tx.shipment.create({
          data: {
            storeId,
            orderId,
            provider: provider.code,
            status: ShipmentStatus.PENDING,
            providerReference: reference,
            codAmount,
            weightKg,
            metadata: { booking: 'in_progress' },
          },
        });
        return { mode: 'book' as const, shipment: created };
      })
      .catch((err: unknown) => {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          throw new ConflictException({ message: 'This order already has an active shipment.', error: 'SHIPMENT_ALREADY_EXISTS' });
        }
        throw err;
      });

    if (reserved.mode === 'reconcile') {
      // Never a second create call: only ask the courier whether it already has the parcel.
      const recovered = await this.reconcile(reserved.shipment, provider, connection.credentials);
      if (!recovered) {
        throw new ConflictException({
          message: `${provider.displayName} has not confirmed the earlier booking for this order, so no new parcel was booked. Check your ${provider.displayName} account: use "Sync status" once it shows the parcel, or "Mark as not booked" if it is not there.`,
          error: 'COURIER_BOOKING_UNCONFIRMED',
        });
      }
      await this.auditCreated(userId, store.tenantId, order.orderNumber, recovered, req);
      return { success: true as const, data: this.toDto(recovered, provider), message: `Recovered the parcel ${provider.displayName} already had for this order. No new parcel was booked.` };
    }

    const shipment = reserved.shipment;
    let booking: CourierBooking;
    try {
      booking = await provider.createShipment(connection.credentials, {
        reference: shipment.providerReference!,
        recipientName,
        recipientPhone,
        recipientAddress,
        codAmount,
        note: dto.note?.trim() || undefined,
      });
    } catch (err) {
      if (courierFailure(err)?.outcome === 'rejected') {
        // The courier refused the request: nothing exists there. Free the order.
        await this.prisma.shipment.deleteMany({ where: { id: shipment.id, providerShipmentId: null } });
      } else {
        // The courier may have the parcel: keep the reference and wait for reconciliation.
        await this.prisma.shipment.update({ where: { id: shipment.id }, data: { metadata: { booking: 'unconfirmed' } } });
      }
      throw err;
    }

    const status = booking.providerStatus ? provider.describeStatus(booking.providerStatus) : null;
    let saved: Shipment;
    try {
      saved = await this.markBooked(shipment.id, provider, booking, status);
    } catch {
      // The courier has the parcel but recording it failed: leave it reconcilable, never re-book.
      await this.prisma.shipment
        .update({ where: { id: shipment.id }, data: { metadata: { booking: 'unconfirmed' } } })
        .catch(() => undefined);
      throw new CourierUnavailableError(
        'COURIER_BOOKING_UNCONFIRMED',
        `${provider.displayName} accepted the parcel but Ecomesta could not record it. Use "Sync status" on the order to confirm it — no new parcel will be booked.`,
      );
    }
    await this.auditCreated(userId, store.tenantId, order.orderNumber, saved, req);
    return { success: true as const, data: this.toDto(saved, provider) };
  }

  async sync(userId: string, storeId: string, orderId: string, shipmentId: string, req?: Request) {
    await this.authorization.assertStoreRole(userId, storeId, [StoreRole.STORE_MANAGER]);
    const store = await this.prisma.store.findUnique({ where: { id: storeId }, select: { tenantId: true } });
    if (!store) throw new NotFoundException('Store not found');
    const shipment = await this.requireCourierShipment(storeId, orderId, shipmentId);
    const provider = this.registry.get(shipment.provider);
    const state = bookingOf(shipment);

    if (state === 'released') {
      throw new UnprocessableEntityException({ message: 'This booking was marked as not booked.', error: 'COURIER_BOOKING_RELEASED' });
    }
    if (state === 'in_progress' && !needsReconciliation(shipment)) {
      // The create call is still running and owns this row: do not touch it.
      throw new ConflictException({
        message: `The ${provider.displayName} booking for this order is still in progress. Try again in a moment.`,
        error: 'COURIER_BOOKING_IN_PROGRESS',
      });
    }
    const connection = await this.requireConnection(storeId, provider);

    if (needsReconciliation(shipment)) {
      const recovered = await this.reconcile(shipment, provider, connection.credentials);
      if (recovered) {
        return { success: true as const, data: this.toDto(recovered, provider), message: `${provider.displayName} confirmed the parcel for this order.` };
      }
      return {
        success: true as const,
        data: this.toDto(shipment, provider),
        message: `${provider.displayName} has not confirmed this booking yet. Check your ${provider.displayName} account; if the parcel is not there, use "Mark as not booked".`,
      };
    }

    const result = await provider.getShipmentStatus(connection.credentials, {
      providerShipmentId: shipment.providerShipmentId,
      reference: shipment.providerReference,
      trackingCode: shipment.trackingNumber,
    });
    const outcome = await this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<{ status: ShipmentStatus; provider_status: string | null }[]>`
        SELECT status, provider_status FROM shipments WHERE id = ${shipment.id}::uuid FOR UPDATE`;
      const row = locked[0]!;
      const next = courierNextStatus(row.status, result.status);
      const now = new Date();
      const data: Prisma.ShipmentUpdateInput = { providerStatus: result.providerStatus, lastSyncedAt: now };
      if (next) {
        data.status = next;
        if (isShippedLike(next) && !isShippedLike(row.status)) data.shippedAt = now;
        if (next === ShipmentStatus.DELIVERED) data.deliveredAt = now;
      }
      const updated = await tx.shipment.update({ where: { id: shipment.id }, data });
      if (next || row.provider_status !== result.providerStatus) {
        await tx.shipmentEvent.create({
          data: { shipmentId: shipment.id, storeId, providerStatus: result.providerStatus, status: result.status, message: result.label, occurredAt: now },
        });
      }
      const fulfillmentChanged = next ? await syncOrderFulfillment(tx, storeId, orderId, next) : false;
      return { updated, from: row.status, next, fulfillmentChanged };
    });

    if (outcome.next) {
      await this.audit.log({
        action: 'SHIPMENT_STATUS_CHANGED',
        entityType: 'Shipment',
        entityId: shipment.id,
        userId,
        tenantId: store.tenantId,
        storeId,
        metadata: { orderId, from: outcome.from, to: outcome.next, providerStatus: result.providerStatus, source: 'courier' },
        req,
      });
    }
    if (outcome.fulfillmentChanged) {
      await this.audit.log({
        action: 'FULFILLMENT_STATUS_CHANGED',
        entityType: 'Order',
        entityId: orderId,
        userId,
        tenantId: store.tenantId,
        storeId,
        metadata: { fulfillmentStatus: FulfillmentStatus.FULFILLED, source: 'courier' },
        req,
      });
    }
    return { success: true as const, data: this.toDto(outcome.updated, provider) };
  }

  /**
   * The merchant checked their courier account and the parcel is not there:
   * close the unconfirmed booking (FAILED) so the order can be booked again
   * with a new reference. The courier is asked once more first — if it does
   * have the parcel, the booking is recovered instead.
   */
  async release(userId: string, storeId: string, orderId: string, shipmentId: string, req?: Request) {
    await this.authorization.assertStoreRole(userId, storeId, [StoreRole.STORE_MANAGER]);
    const store = await this.prisma.store.findUnique({ where: { id: storeId }, select: { tenantId: true } });
    if (!store) throw new NotFoundException('Store not found');
    const shipment = await this.requireCourierShipment(storeId, orderId, shipmentId);
    const provider = this.registry.get(shipment.provider);
    if (!needsReconciliation(shipment)) {
      throw new ConflictException({
        message: 'Only a booking the courier has not confirmed can be marked as not booked.',
        error: 'COURIER_BOOKING_NOT_UNCONFIRMED',
      });
    }
    const connection = await this.connections.credentialsFor(storeId, provider);
    if (connection) {
      const recovered = await this.reconcile(shipment, provider, connection.credentials).catch(() => null);
      if (recovered) {
        return { success: true as const, data: this.toDto(recovered, provider), message: `${provider.displayName} does have this parcel, so the booking was confirmed instead.` };
      }
    }

    const released = await this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM shipments WHERE id = ${shipment.id}::uuid FOR UPDATE`;
      const row = locked[0] ? await tx.shipment.findUnique({ where: { id: shipment.id } }) : null;
      if (!row || !needsReconciliation(row)) {
        throw new ConflictException({ message: 'This booking changed meanwhile. Reload the order.', error: 'COURIER_BOOKING_CHANGED' });
      }
      const now = new Date();
      const updated = await tx.shipment.update({
        where: { id: row.id },
        data: { status: ShipmentStatus.FAILED, metadata: { booking: 'released', releasedAt: now.toISOString(), releasedBy: userId } },
      });
      await tx.shipmentEvent.create({
        data: {
          shipmentId: row.id,
          storeId,
          providerStatus: row.providerStatus,
          status: ShipmentStatus.FAILED,
          message: `Marked as not booked by the merchant after checking ${provider.displayName}`,
          occurredAt: now,
        },
      });
      return updated;
    });
    await this.audit.log({
      action: 'COURIER_BOOKING_RELEASED',
      entityType: 'Shipment',
      entityId: shipment.id,
      userId,
      tenantId: store.tenantId,
      storeId,
      metadata: { orderId, provider: shipment.provider, reference: shipment.providerReference },
      req,
    });
    return { success: true as const, data: this.toDto(released, provider), message: 'Marked as not booked. You can book this order again.' };
  }

  /**
   * Asks the courier (by our reference) whether it holds the parcel. Recovers
   * and returns the booking when it does; null when the courier does not
   * confirm it (its "not found" answer is undocumented, so it is never taken as
   * proof the parcel does not exist). Temporary courier failures are thrown and
   * change nothing.
   */
  private async reconcile(shipment: Shipment, provider: CourierProvider, credentials: CourierCredentials) {
    let status: CourierStatusResult;
    try {
      status = await provider.getShipmentStatus(credentials, { providerShipmentId: null, reference: shipment.providerReference, trackingCode: null });
    } catch (err) {
      const failure = courierFailure(err);
      if (failure?.code === 'COURIER_SHIPMENT_NOT_FOUND') return null;
      if (failure?.outcome === 'uncertain') {
        throw new CourierUnavailableError(
          failure.code,
          `${provider.displayName} could not confirm the earlier booking right now, so no new parcel was booked. Try again shortly.`,
        );
      }
      throw err;
    }
    return this.markBooked(shipment.id, provider, { providerShipmentId: null, trackingCode: null, providerStatus: status.providerStatus }, status);
  }

  /** Records the courier's confirmation. Safe to repeat: an already confirmed booking is returned unchanged. */
  private async markBooked(shipmentId: string, provider: CourierProvider, booking: CourierBooking, status: CourierStatusResult | null) {
    const now = new Date();
    // An accepted booking is at least LABEL_CREATED, whatever the courier calls it.
    const next = courierNextStatus(ShipmentStatus.PENDING, status?.status ?? null) ?? ShipmentStatus.LABEL_CREATED;
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM shipments WHERE id = ${shipmentId}::uuid FOR UPDATE`;
      const row = await tx.shipment.findUnique({ where: { id: shipmentId } });
      if (!row) throw new NotFoundException('Shipment not found');
      if (bookingOf(row) === 'confirmed' || bookingOf(row) === 'released' || CLOSED.includes(row.status)) return row;
      const updated = await tx.shipment.update({
        where: { id: shipmentId },
        data: {
          providerShipmentId: booking.providerShipmentId,
          trackingNumber: booking.trackingCode,
          providerStatus: booking.providerStatus ?? status?.providerStatus ?? null,
          status: next,
          shippedAt: isShippedLike(next) ? now : null,
          deliveredAt: next === ShipmentStatus.DELIVERED ? now : null,
          lastSyncedAt: now,
          metadata: { booking: 'confirmed', ...(booking.trackingCode ? {} : { trackingCodeMissing: true }) },
        },
      });
      await tx.shipmentEvent.create({
        data: {
          shipmentId,
          storeId: row.storeId,
          providerStatus: updated.providerStatus,
          status: next,
          message: `Booked with ${provider.displayName}${status ? ` — ${status.label}` : ''}`,
          occurredAt: now,
        },
      });
      await syncOrderFulfillment(tx, row.storeId, row.orderId, next);
      return updated;
    });
  }

  private async requireCourierShipment(storeId: string, orderId: string, shipmentId: string) {
    const shipment = await this.prisma.shipment.findFirst({ where: { id: shipmentId, storeId, orderId } });
    if (!shipment) throw new NotFoundException('Shipment not found');
    if (!shipment.providerReference) {
      throw new UnprocessableEntityException({ message: 'This shipment was not booked with a courier.', error: 'SHIPMENT_NOT_COURIER' });
    }
    return shipment;
  }

  private async requireConnection(storeId: string, provider: CourierProvider) {
    const connection = await this.connections.credentialsFor(storeId, provider);
    if (!connection) {
      throw new UnprocessableEntityException({
        message: `Connect ${provider.displayName} in Settings → Couriers first.`,
        error: 'COURIER_NOT_CONNECTED',
      });
    }
    return connection;
  }

  private async auditCreated(userId: string, tenantId: string, orderNumber: string, shipment: Shipment, req?: Request) {
    await this.audit.log({
      action: 'SHIPMENT_CREATED',
      entityType: 'Shipment',
      entityId: shipment.id,
      userId,
      tenantId,
      storeId: shipment.storeId,
      // No recipient details or credentials in the audit trail.
      metadata: {
        orderId: shipment.orderId,
        orderNumber,
        provider: shipment.provider,
        status: shipment.status,
        codAmount: shipment.codAmount?.toFixed(2) ?? null,
        source: 'courier',
      },
      req,
    });
  }

  private toDto(shipment: Shipment, provider: CourierProvider) {
    return {
      id: shipment.id,
      orderId: shipment.orderId,
      provider: shipment.provider,
      courierName: provider.displayName,
      trackingNumber: shipment.trackingNumber,
      trackingUrl: provider.trackingUrl({
        providerShipmentId: shipment.providerShipmentId,
        reference: shipment.providerReference,
        trackingCode: shipment.trackingNumber,
      }),
      status: shipment.status,
      supportsCancellation: provider.supportsCancellation,
      shippedAt: shipment.shippedAt,
      deliveredAt: shipment.deliveredAt,
      ...courierFields(shipment),
      createdAt: shipment.createdAt,
      updatedAt: shipment.updatedAt,
    };
  }
}

/**
 * Cash the courier collects, from the server's own order and payment state:
 * paid orders collect nothing; unpaid cash-on-delivery orders collect the order
 * total; anything else (online payment not completed, partial or refunded
 * payments) cannot be sent until it is settled.
 */
export function codAmountFor(
  order: { grandTotal: Prisma.Decimal; paymentStatus: PaymentStatus },
  latestPaymentProvider: PaymentProvider | null,
): string {
  if (order.paymentStatus === PaymentStatus.PAID) return '0.00';
  if (order.paymentStatus === PaymentStatus.PENDING && latestPaymentProvider === PaymentProvider.COD) {
    return order.grandTotal.toFixed(2);
  }
  throw notShippable(
    order.paymentStatus === PaymentStatus.PENDING
      ? 'The online payment for this order has not been completed yet.'
      : `Orders with payment status ${order.paymentStatus.toLowerCase().replace(/_/g, ' ')} cannot be sent to a courier.`,
  );
}

function notShippable(message: string) {
  return new UnprocessableEntityException({ message, error: 'ORDER_NOT_SHIPPABLE' });
}
