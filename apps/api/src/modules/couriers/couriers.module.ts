import { Module } from '@nestjs/common';
import { PaymentsModule } from '../payments/payments.module';
import { CourierConnectionsService } from './courier-connections.service';
import { CourierProviderRegistry } from './courier-provider.registry';
import { CourierShipmentsService } from './courier-shipments.service';
import { CouriersController } from './couriers.controller';
import { CourierHttp } from './courier.http';
import { ECourierCourierProvider } from './providers/ecourier/ecourier-courier.provider';
import { PaperflyCourierProvider } from './providers/paperfly/paperfly-courier.provider';
import { PathaoCourierProvider } from './providers/pathao/pathao-courier.provider';
import { RedxCourierProvider } from './providers/redx/redx-courier.provider';
import { SteadfastCourierProvider } from './providers/steadfast/steadfast-courier.provider';
import { SteadfastHttp } from './providers/steadfast/steadfast.http';

/** Courier integrations: Steadfast, Pathao, RedX, Paperfly and eCourier plug into the registry. */
@Module({
  // PaymentsModule provides the AES-256-GCM secrets service used for courier credentials.
  imports: [PaymentsModule],
  controllers: [CouriersController],
  providers: [
    SteadfastHttp,
    CourierHttp,
    SteadfastCourierProvider,
    PathaoCourierProvider,
    RedxCourierProvider,
    PaperflyCourierProvider,
    ECourierCourierProvider,
    CourierProviderRegistry,
    CourierConnectionsService,
    CourierShipmentsService,
  ],
})
export class CouriersModule {}
