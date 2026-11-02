import { Prisma } from '@prisma/client';
import { OrderPlacementService } from './order-placement.service';
import { OrdersService } from './orders.service';

const address = {
  firstName: 'Rahima',
  lastName: 'Akter',
  phone: '01811222333',
  email: 'rahima@example.com',
};

describe('OrdersService.toListDto itemCount', () => {
  it('sums line quantities instead of counting lines', () => {
    const service = Object.create(OrdersService.prototype) as {
      toListDto: (order: unknown) => { itemCount: number };
    };
    const dto = service.toListDto({
      id: 'o1',
      storeId: 's1',
      customerId: null,
      orderNumber: 'EM-1',
      status: 'PENDING',
      paymentStatus: 'PENDING',
      fulfillmentStatus: 'UNFULFILLED',
      currency: 'BDT',
      subtotal: new Prisma.Decimal('300'),
      discountTotal: new Prisma.Decimal('0'),
      shippingTotal: new Prisma.Decimal('0'),
      taxTotal: new Prisma.Decimal('0'),
      grandTotal: new Prisma.Decimal('300'),
      createdAt: new Date(),
      updatedAt: new Date(),
      customer: null,
      items: [
        { id: 'a', quantity: 3 },
        { id: 'b', quantity: 2 },
      ],
      _count: { items: 2 },
    });
    expect(dto.itemCount).toBe(5);
  });
});

describe('OrderPlacementService.upsertGuestCustomer', () => {
  type Row = { id: string; firstName: string | null; lastName: string | null };

  function setup(found: Array<Row | null>) {
    const findFirst = jest.fn();
    for (const row of found) findFirst.mockResolvedValueOnce(row);
    findFirst.mockResolvedValue(null);
    const tx = {
      customer: { findFirst, update: jest.fn() },
      $executeRaw: jest.fn().mockResolvedValue(1),
    };
    const service = new OrderPlacementService({} as never, {} as never) as unknown as {
      upsertGuestCustomer: (
        tx: unknown,
        storeId: string,
        shipping: unknown,
        billing: unknown,
      ) => Promise<string | null>;
    };
    return { tx, service };
  }

  it('reuses an existing store customer matched by email', async () => {
    const { tx, service } = setup([{ id: 'c1', firstName: 'Rahima', lastName: 'Akter' }]);
    const id = await service.upsertGuestCustomer(tx, 'store-1', address, address);
    expect(id).toBe('c1');
    expect(tx.customer.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { storeId: 'store-1', email: 'rahima@example.com' } }),
    );
    expect(tx.$executeRaw).not.toHaveBeenCalled();
  });

  it('creates a customer scoped to the store when none matches', async () => {
    // email miss, phone miss, then the post-insert lookup finds the new row
    const { tx, service } = setup([null, null, { id: 'c2', firstName: 'Rahima', lastName: 'Akter' }]);
    const id = await service.upsertGuestCustomer(tx, 'store-1', address, address);
    expect(id).toBe('c2');
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it('skips guests with no email or phone', async () => {
    const { tx, service } = setup([]);
    const blank = { firstName: 'X', lastName: null, phone: null, email: null };
    expect(await service.upsertGuestCustomer(tx, 'store-1', blank, blank)).toBeNull();
    expect(tx.customer.findFirst).not.toHaveBeenCalled();
  });
});
