import { PaymentProvider, PaymentStatus, Prisma, ShipmentStatus } from '@prisma/client';
import { codAmountFor, courierNextStatus } from './courier-shipments.service';
import { formatDeliveryAddress, normalizeBdMobile } from './courier-recipient';
import { mapSteadfastStatus } from './providers/steadfast/steadfast-status';

describe('courier rules', () => {
  it.each([
    ['01711-000000', '01711000000'],
    ['+880 1711 000000', '01711000000'],
    ['8801711000000', '01711000000'],
    ['1711000000', '01711000000'],
    ['01211000000', null], // not a mobile prefix
    ['0171100000', null],
    ['', null],
    [null, null],
  ])('normalises the phone %p to %p', (input, expected) => {
    expect(normalizeBdMobile(input)).toBe(expected);
  });

  it('builds one delivery line without blanks or repeats', () => {
    expect(
      formatDeliveryAddress({
        addressLine1: 'House 1, Road 2',
        addressLine2: null,
        landmark: 'Rapa Plaza',
        upazilaName: 'Dhanmondi',
        districtName: 'Dhaka',
        city: 'Dhaka',
        postalCode: 'N/A',
      }),
    ).toBe('House 1, Road 2, Near Rapa Plaza, Dhanmondi, Dhaka');
  });

  describe('COD amount comes from the order, never the client', () => {
    const order = (paymentStatus: PaymentStatus) => ({ grandTotal: new Prisma.Decimal('1250.5'), paymentStatus });
    it('collects the order total for an unpaid cash-on-delivery order', () => {
      expect(codAmountFor(order(PaymentStatus.PENDING), PaymentProvider.COD)).toBe('1250.50');
    });
    it('keeps the stored two-decimal amount; only the courier payload is converted', () => {
      const whole = { grandTotal: new Prisma.Decimal('1250'), paymentStatus: PaymentStatus.PENDING };
      expect(codAmountFor(whole, PaymentProvider.COD)).toBe('1250.00');
      expect(whole.grandTotal.toFixed(2)).toBe('1250.00');
    });
    it('collects nothing for a paid order', () => {
      expect(codAmountFor(order(PaymentStatus.PAID), PaymentProvider.STRIPE)).toBe('0.00');
    });
    it.each([
      [PaymentStatus.PENDING, PaymentProvider.SSL_COMMERZ],
      [PaymentStatus.PARTIALLY_PAID, PaymentProvider.COD],
      [PaymentStatus.REFUNDED, PaymentProvider.COD],
      [PaymentStatus.FAILED, PaymentProvider.STRIPE],
    ])('refuses %s via %s', (status, provider) => {
      expect(() => codAmountFor(order(status), provider)).toThrow(expect.objectContaining({ response: expect.objectContaining({ error: 'ORDER_NOT_SHIPPABLE' }) }));
    });
  });

  describe('courier status moves a shipment forward only', () => {
    it.each([
      [ShipmentStatus.PENDING, ShipmentStatus.LABEL_CREATED, ShipmentStatus.LABEL_CREATED],
      [ShipmentStatus.LABEL_CREATED, ShipmentStatus.DELIVERED, ShipmentStatus.DELIVERED],
      [ShipmentStatus.LABEL_CREATED, ShipmentStatus.CANCELLED, ShipmentStatus.CANCELLED],
      [ShipmentStatus.IN_TRANSIT, ShipmentStatus.CANCELLED, ShipmentStatus.RETURNED],
      [ShipmentStatus.DELIVERED, ShipmentStatus.LABEL_CREATED, null],
      [ShipmentStatus.DELIVERED, ShipmentStatus.CANCELLED, ShipmentStatus.RETURNED],
      [ShipmentStatus.CANCELLED, ShipmentStatus.DELIVERED, null],
      [ShipmentStatus.LABEL_CREATED, null, null],
      [ShipmentStatus.LABEL_CREATED, ShipmentStatus.LABEL_CREATED, null],
    ])('%s + courier %s → %s', (current, mapped, expected) => {
      expect(courierNextStatus(current, mapped)).toBe(expected);
    });
  });

  it('maps every Steadfast status it documents, and nothing else, to a shipment status', () => {
    expect(mapSteadfastStatus('in_review').status).toBe(ShipmentStatus.LABEL_CREATED);
    expect(mapSteadfastStatus('pending').status).toBe(ShipmentStatus.LABEL_CREATED);
    expect(mapSteadfastStatus('delivered_approval_pending').status).toBe(ShipmentStatus.DELIVERED);
    expect(mapSteadfastStatus('Delivered').status).toBe(ShipmentStatus.DELIVERED);
    expect(mapSteadfastStatus('cancelled').status).toBe(ShipmentStatus.CANCELLED);
    for (const unsafe of ['hold', 'partial_delivered', 'partial_delivered_approval_pending', 'unknown', 'unknown_approval_pending', 'lost_in_space']) {
      expect(mapSteadfastStatus(unsafe).status).toBeNull();
    }
  });
});
