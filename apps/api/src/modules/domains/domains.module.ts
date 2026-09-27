import { Module } from '@nestjs/common';
import { DOMAIN_DNS_PROVIDER, SystemDnsProvider } from './domain-dns.provider';
import { DomainsController } from './domains.controller';
import { DomainsService } from './domains.service';
import { PublicDomainController } from './public-domain.controller';
import { StoreDomainResolver } from './store-domain.resolver';

@Module({
  controllers: [DomainsController, PublicDomainController],
  providers: [
    DomainsService,
    StoreDomainResolver,
    { provide: DOMAIN_DNS_PROVIDER, useClass: SystemDnsProvider },
  ],
  exports: [StoreDomainResolver],
})
export class DomainsModule {}
