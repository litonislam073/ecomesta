import { Injectable, NotFoundException } from '@nestjs/common';
import type { ShippingProvider } from '@prisma/client';
import type { CourierProvider } from './courier-provider';
import { SteadfastCourierProvider } from './providers/steadfast/steadfast-courier.provider';

/** Couriers a store can connect. Add Pathao / RedX / Paperfly providers here. */
@Injectable()
export class CourierProviderRegistry {
  private readonly providers: Map<ShippingProvider, CourierProvider>;

  constructor(steadfast: SteadfastCourierProvider) {
    this.providers = new Map<ShippingProvider, CourierProvider>([[steadfast.code, steadfast]]);
  }

  list(): CourierProvider[] {
    return [...this.providers.values()];
  }

  get(code: string): CourierProvider {
    const provider = this.providers.get(code as ShippingProvider);
    if (!provider) throw new NotFoundException('Courier not supported');
    return provider;
  }
}
