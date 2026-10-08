import { Module } from '@nestjs/common';
import { PaymentsModule } from '../payments/payments.module';
import { CourierConnectionsService } from './courier-connections.service';
import { CourierProviderRegistry } from './courier-provider.registry';
import { CourierShipmentsService } from './courier-shipments.service';
import { CouriersController } from './couriers.controller';
import { SteadfastCourierProvider } from './providers/steadfast/steadfast-courier.provider';
import { SteadfastHttp } from './providers/steadfast/steadfast.http';

/** Courier integrations (Steadfast; more providers plug into the registry). */
@Module({
  // PaymentsModule provides the AES-256-GCM secrets service used for courier credentials.
  imports: [PaymentsModule],
  controllers: [CouriersController],
  providers: [SteadfastHttp, SteadfastCourierProvider, CourierProviderRegistry, CourierConnectionsService, CourierShipmentsService],
})
export class CouriersModule {}
