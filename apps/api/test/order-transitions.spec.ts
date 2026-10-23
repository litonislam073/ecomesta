import { OrderStatus } from '@prisma/client';
import { UnprocessableEntityException } from '@nestjs/common';
import { assertOrderStatusTransition } from '../src/modules/orders/order-transitions';

describe('assertOrderStatusTransition', () => {
  it('allows limited reverse edges', () => {
    expect(() =>
      assertOrderStatusTransition(OrderStatus.PROCESSING, OrderStatus.CONFIRMED),
    ).not.toThrow();
    expect(() =>
      assertOrderStatusTransition(OrderStatus.CONFIRMED, OrderStatus.PENDING),
    ).not.toThrow();
    expect(() =>
      assertOrderStatusTransition(OrderStatus.COMPLETED, OrderStatus.PROCESSING),
    ).not.toThrow();
  });

  it('still blocks invalid jumps and leaving cancelled', () => {
    expect(() =>
      assertOrderStatusTransition(OrderStatus.PENDING, OrderStatus.COMPLETED),
    ).toThrow(UnprocessableEntityException);
    expect(() =>
      assertOrderStatusTransition(OrderStatus.CANCELLED, OrderStatus.PENDING),
    ).toThrow(UnprocessableEntityException);
  });
});
