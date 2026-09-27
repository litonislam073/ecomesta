import {
  Controller,
  Get,
  NotFoundException,
  Query,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import {
  selectRequestHost,
  trustProxyEnabled,
} from '../../common/utils/request-host.util';
import { BillingAccessService } from '../billing/billing-access.service';
import { ResolveDomainQueryDto } from './dto/domain.dto';
import { StoreDomainResolver } from './store-domain.resolver';

@ApiTags('public-storefront')
@Controller({ path: 'public/domain', version: '1' })
export class PublicDomainController {
  constructor(
    private readonly resolver: StoreDomainResolver,
    private readonly billingAccess: BillingAccessService,
  ) {}

  @Get('resolve')
  @ApiOperation({
    summary: 'Resolve a storefront host to its ACTIVE store (edge routing)',
  })
  async resolve(@Query() query: ResolveDomainQueryDto, @Req() req: Request) {
    const host = query.host?.trim() || this.requestHost(req);
    const resolved = host ? await this.resolver.resolve(host) : null;
    if (!resolved) {
      const normalized = host ? this.resolver.normalize(host) : null;
      if (normalized) {
        // Suspended stores get a neutral "unavailable" answer; unknown and
        // inactive hosts keep the same 404.
        const slug = this.resolver.platformSlugFor(normalized);
        await this.billingAccess.throwIfSuspended(slug ? { slug } : { hostname: normalized });
      }
      throw new NotFoundException('Storefront not found for this host');
    }
    await this.billingAccess.assertStoreInGoodStanding(resolved.store.id);
    return { success: true as const, data: resolved };
  }

  private requestHost(req: Request): string | null {
    const forwarded = req.headers['x-forwarded-host'];
    const forwardedHost = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    return selectRequestHost({
      hostHeader: req.headers.host ?? null,
      forwardedHostHeader: forwardedHost ?? null,
      trustProxy: trustProxyEnabled(process.env),
    });
  }
}
