import { Injectable, NotFoundException } from '@nestjs/common';
import type { ShippingProvider } from '@prisma/client';
import type { CourierProvider } from './courier-provider';
import { ECourierCourierProvider } from './providers/ecourier/ecourier-courier.provider';
import { PaperflyCourierProvider } from './providers/paperfly/paperfly-courier.provider';
import { PathaoCourierProvider } from './providers/pathao/pathao-courier.provider';
import { RedxCourierProvider } from './providers/redx/redx-courier.provider';
import { SteadfastCourierProvider } from './providers/steadfast/steadfast-courier.provider';

/** Couriers a store can connect, in the order the dashboard lists them. */
@Injectable()
export class CourierProviderRegistry {
  private readonly providers: Map<ShippingProvider, CourierProvider>;

  constructor(
    steadfast: SteadfastCourierProvider,
    pathao: PathaoCourierProvider,
    redx: RedxCourierProvider,
    paperfly: PaperflyCourierProvider,
    ecourier: ECourierCourierProvider,
  ) {
    this.providers = new Map<ShippingProvider, CourierProvider>(
      [steadfast, pathao, redx, paperfly, ecourier].map((provider) => [provider.code, provider]),
    );
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
