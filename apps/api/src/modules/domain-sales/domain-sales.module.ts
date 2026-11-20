import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DomainsModule } from '../domains/domains.module';
import { AdminDomainSalesController, DomainSalesController, PublicDomainSalesController } from './domain-sales.controllers';
import { DomainSalesService } from './domain-sales.service';
import { DOMAIN_REGISTRAR, DynadotClient } from './dynadot.client';

@Module({
  imports: [AuthModule, DomainsModule],
  controllers: [PublicDomainSalesController, DomainSalesController, AdminDomainSalesController],
  providers: [DomainSalesService, DynadotClient, { provide: DOMAIN_REGISTRAR, useExisting: DynadotClient }],
})
export class DomainSalesModule {}
