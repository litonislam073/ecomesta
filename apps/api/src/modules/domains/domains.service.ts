import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  Domain,
  DomainStatus,
  DomainType,
  StoreRole,
} from '@prisma/client';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { PlanEntitlementsService } from '../billing/plan-entitlements.service';
import { AuditService } from '../audit/audit.service';
import { AuthorizationService } from '../authorization/authorization.service';
import {
  DOMAIN_DNS_PROVIDER,
  DomainDnsProvider,
} from './domain-dns.provider';
import {
  isReservedHostname,
  validateHostname,
  verificationRecordName,
} from './domain-normalize';
import { CreateDomainDto } from './dto/domain.dto';
import { StoreDomainResolver } from './store-domain.resolver';

interface StoreRef {
  id: string;
  slug: string;
  tenantId: string;
}

/** Statuses where the merchant still needs the DNS challenge instructions. */
/** Statuses where DNS challenge instructions (without the secret) are shown. */
const CHALLENGE_STATUSES: DomainStatus[] = [
  DomainStatus.PENDING,
  DomainStatus.FAILED,
  DomainStatus.VERIFIED,
];

const HASH_PREFIX = 'sha256:';

@Injectable()
export class DomainsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
    private readonly audit: AuditService,
    private readonly resolver: StoreDomainResolver,
    @Inject(DOMAIN_DNS_PROVIDER) private readonly dns: DomainDnsProvider,
    private readonly entitlements: PlanEntitlementsService,
  ) {}

  async list(userId: string, storeId: string) {
    await this.authorization.assertStoreAccess(userId, storeId);
    const store = await this.requireStore(storeId);
    await this.resolver.ensurePlatformDomain(store);

    const items = await this.prisma.domain.findMany({
      where: { storeId },
      orderBy: [{ type: 'asc' }, { createdAt: 'asc' }],
    });

    return {
      success: true as const,
      data: {
        items: items.map((domain) => this.toDto(domain)),
        meta: {
          total: items.length,
          platformRootDomain: this.resolver.platformRootDomain,
          canonicalHostname: await this.resolver.canonicalHostname(store),
        },
      },
    };
  }

  async get(userId: string, storeId: string, domainId: string) {
    await this.authorization.assertStoreAccess(userId, storeId);
    const domain = await this.requireDomain(storeId, domainId);
    return { success: true as const, data: this.toDto(domain) };
  }

  async create(
    userId: string,
    storeId: string,
    dto: CreateDomainDto,
    req?: Request,
  ) {
    const store = await this.assertWriteAccess(userId, storeId);
    await this.entitlements.assertFeature(storeId, 'customDomain');
    const hostname = this.normalizeOrThrow(dto.hostname);

    if (isReservedHostname(hostname, this.resolver.platformRootDomain)) {
      throw new BadRequestException(
        'This hostname is reserved by the platform',
      );
    }

    const existing = await this.prisma.domain.findUnique({
      where: { hostname },
      select: { id: true },
    });
    if (existing) {
      // Same message regardless of owner — domain ownership is not enumerable.
      throw new ConflictException('This hostname is already in use');
    }

    const rawToken = this.generateVerificationToken();
    const domain = await this.prisma.domain.create({
      data: {
        storeId,
        hostname,
        type: DomainType.CUSTOM_DOMAIN,
        status: DomainStatus.PENDING,
        isPrimary: false,
        verificationToken: this.hashVerificationToken(rawToken),
      },
    });

    await this.audit.log({
      action: 'DOMAIN_CREATED',
      entityType: 'Domain',
      entityId: domain.id,
      userId,
      tenantId: store.tenantId,
      storeId,
      metadata: { hostname: domain.hostname, type: domain.type },
      req,
    });

    // Raw token returned once; list/get never expose hash or secret.
    return {
      success: true as const,
      data: this.toDto(domain, { rawVerificationToken: rawToken }),
    };
  }

  /**
   * Issue a new DNS challenge token (raw returned once). Invalidates the prior hash.
   */
  async regenerateVerificationToken(
    userId: string,
    storeId: string,
    domainId: string,
    req?: Request,
  ) {
    const store = await this.assertWriteAccess(userId, storeId);
    const domain = await this.requireDomain(storeId, domainId);

    if (domain.type !== DomainType.CUSTOM_DOMAIN) {
      throw new UnprocessableEntityException(
        'Platform subdomains do not use verification tokens',
      );
    }
    if (
      domain.status === DomainStatus.ACTIVE ||
      domain.status === DomainStatus.DISABLED
    ) {
      throw new UnprocessableEntityException(
        'Cannot regenerate verification for an active or disabled domain',
      );
    }

    const rawToken = this.generateVerificationToken();
    const updated = await this.prisma.domain.update({
      where: { id: domain.id },
      data: {
        verificationToken: this.hashVerificationToken(rawToken),
        status:
          domain.status === DomainStatus.VERIFIED ||
          domain.status === DomainStatus.FAILED
            ? DomainStatus.PENDING
            : domain.status,
        verifiedAt: null,
      },
    });

    await this.audit.log({
      action: 'DOMAIN_VERIFICATION_REGENERATED',
      entityType: 'Domain',
      entityId: updated.id,
      userId,
      tenantId: store.tenantId,
      storeId,
      metadata: { hostname: updated.hostname },
      req,
    });

    return {
      success: true as const,
      data: this.toDto(updated, { rawVerificationToken: rawToken }),
    };
  }

  async verify(
    userId: string,
    storeId: string,
    domainId: string,
    req?: Request,
  ) {
    const store = await this.assertWriteAccess(userId, storeId);
    const domain = await this.requireDomain(storeId, domainId);

    if (domain.type !== DomainType.CUSTOM_DOMAIN) {
      throw new UnprocessableEntityException(
        'Platform subdomains do not require verification',
      );
    }
    if (
      domain.status === DomainStatus.VERIFIED ||
      domain.status === DomainStatus.ACTIVE
    ) {
      return { success: true as const, data: this.toDto(domain) };
    }
    if (domain.status === DomainStatus.DISABLED) {
      throw new UnprocessableEntityException(
        'Disabled domains cannot be verified; delete and re-add the domain',
      );
    }

    if (!domain.verificationToken) {
      throw new UnprocessableEntityException(
        'No verification token configured; regenerate the DNS challenge first',
      );
    }

    const recordName = verificationRecordName(domain.hostname.toLowerCase());
    const records = await this.dns.lookupTxt(recordName);
    const matched = records.some((value) =>
      this.tokenMatchesStoredHash(
        this.stripQuotes(value),
        domain.verificationToken!,
      ),
    );

    if (!matched) {
      const failed = await this.prisma.domain.update({
        where: { id: domain.id },
        data: { status: DomainStatus.FAILED },
      });
      throw new UnprocessableEntityException({
        message: `No matching TXT record found at ${recordName}`,
        error: 'Domain Verification Failed',
        details: {
          recordName,
          recordsFound: records.length,
          domain: this.toDto(failed),
        },
      });
    }

    // Clear the challenge hash after successful verify (raw was only shown once).
    const verified = await this.prisma.domain.update({
      where: { id: domain.id },
      data: {
        status: DomainStatus.VERIFIED,
        verifiedAt: new Date(),
        verificationToken: null,
      },
    });

    await this.audit.log({
      action: 'DOMAIN_VERIFIED',
      entityType: 'Domain',
      entityId: verified.id,
      userId,
      tenantId: store.tenantId,
      storeId,
      metadata: { hostname: verified.hostname, recordName },
      req,
    });

    return { success: true as const, data: this.toDto(verified) };
  }

  async activate(
    userId: string,
    storeId: string,
    domainId: string,
    req?: Request,
  ) {
    const store = await this.assertWriteAccess(userId, storeId);
    const domain = await this.requireDomain(storeId, domainId);

    if (domain.status === DomainStatus.ACTIVE) {
      return { success: true as const, data: this.toDto(domain) };
    }
    if (domain.status !== DomainStatus.VERIFIED) {
      throw new UnprocessableEntityException(
        'Domain must pass DNS verification before it can be activated',
      );
    }

    const activated = await this.prisma.domain.update({
      where: { id: domain.id },
      data: {
        status: DomainStatus.ACTIVE,
        verifiedAt: domain.verifiedAt ?? new Date(),
        // The challenge record is no longer needed once traffic is served.
        verificationToken: null,
      },
    });

    await this.resolver.invalidateStore(storeId);
    await this.audit.log({
      action: 'DOMAIN_ACTIVATED',
      entityType: 'Domain',
      entityId: activated.id,
      userId,
      tenantId: store.tenantId,
      storeId,
      metadata: { hostname: activated.hostname },
      req,
    });

    return { success: true as const, data: this.toDto(activated) };
  }

  async setPrimary(
    userId: string,
    storeId: string,
    domainId: string,
    req?: Request,
  ) {
    const store = await this.assertWriteAccess(userId, storeId);
    const domain = await this.requireDomain(storeId, domainId);

    if (domain.status !== DomainStatus.ACTIVE) {
      throw new UnprocessableEntityException(
        'Only active domains can be made primary',
      );
    }

    const primary = await this.prisma.$transaction(async (tx) => {
      await tx.domain.updateMany({
        where: { storeId, isPrimary: true, id: { not: domain.id } },
        data: { isPrimary: false },
      });
      return tx.domain.update({
        where: { id: domain.id },
        data: { isPrimary: true },
      });
    });

    await this.resolver.invalidateStore(storeId);
    await this.audit.log({
      action: 'DOMAIN_PRIMARY_CHANGED',
      entityType: 'Domain',
      entityId: primary.id,
      userId,
      tenantId: store.tenantId,
      storeId,
      metadata: { hostname: primary.hostname },
      req,
    });

    return { success: true as const, data: this.toDto(primary) };
  }

  async disable(
    userId: string,
    storeId: string,
    domainId: string,
    req?: Request,
  ) {
    const store = await this.assertWriteAccess(userId, storeId);
    const domain = await this.requireDomain(storeId, domainId);

    if (domain.type === DomainType.SUBDOMAIN) {
      throw new UnprocessableEntityException(
        'The platform subdomain cannot be disabled',
      );
    }
    if (domain.status === DomainStatus.DISABLED) {
      return { success: true as const, data: this.toDto(domain) };
    }

    const fallback = domain.isPrimary
      ? await this.resolver.ensurePlatformDomain(store)
      : null;

    const disabled = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.domain.update({
        where: { id: domain.id },
        data: { status: DomainStatus.DISABLED, isPrimary: false },
      });
      if (fallback) {
        await tx.domain.update({
          where: { id: fallback.id },
          data: { isPrimary: true },
        });
      }
      return updated;
    });

    await this.resolver.invalidateStore(storeId);
    await this.audit.log({
      action: 'DOMAIN_DISABLED',
      entityType: 'Domain',
      entityId: disabled.id,
      userId,
      tenantId: store.tenantId,
      storeId,
      metadata: {
        hostname: disabled.hostname,
        primaryFallback: fallback?.hostname ?? null,
      },
      req,
    });

    return { success: true as const, data: this.toDto(disabled) };
  }

  async remove(
    userId: string,
    storeId: string,
    domainId: string,
    req?: Request,
  ) {
    const store = await this.assertWriteAccess(userId, storeId);
    const domain = await this.requireDomain(storeId, domainId);

    if (domain.type === DomainType.SUBDOMAIN) {
      throw new UnprocessableEntityException(
        'The platform subdomain cannot be deleted',
      );
    }

    // A store always keeps a primary host, so hand it back to the subdomain.
    const fallback = domain.isPrimary
      ? await this.resolver.ensurePlatformDomain(store)
      : null;

    await this.prisma.$transaction(async (tx) => {
      if (fallback) {
        await tx.domain.update({
          where: { id: fallback.id },
          data: { isPrimary: true },
        });
      }
      await tx.domain.delete({ where: { id: domain.id } });
    });

    await this.resolver.invalidateHostname(domain.hostname.toLowerCase());
    await this.resolver.invalidateStore(storeId);
    await this.audit.log({
      action: 'DOMAIN_DELETED',
      entityType: 'Domain',
      entityId: domain.id,
      userId,
      tenantId: store.tenantId,
      storeId,
      metadata: {
        hostname: domain.hostname,
        primaryFallback: fallback?.hostname ?? null,
      },
      req,
    });

    return {
      success: true as const,
      data: { id: domain.id, hostname: domain.hostname.toLowerCase() },
    };
  }

  // ---------------------------------------------------------------------------

  private async assertWriteAccess(
    userId: string,
    storeId: string,
  ): Promise<StoreRef> {
    await this.authorization.assertStoreRole(userId, storeId, [
      StoreRole.STORE_MANAGER,
    ]);
    return this.requireStore(storeId);
  }

  private async requireStore(storeId: string): Promise<StoreRef> {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      select: { id: true, slug: true, tenantId: true },
    });
    if (!store) {
      throw new NotFoundException('Store not found');
    }
    return store;
  }

  private async requireDomain(
    storeId: string,
    domainId: string,
  ): Promise<Domain> {
    const domain = await this.prisma.domain.findFirst({
      where: { id: domainId, storeId },
    });
    if (!domain) {
      throw new NotFoundException('Domain not found');
    }
    return domain;
  }

  private normalizeOrThrow(input: string): string {
    const normalized = this.resolver.normalize(input);
    if (!normalized) {
      const { error } = validateHostname(input);
      throw new BadRequestException(error ?? 'Invalid hostname');
    }
    return normalized;
  }

  private generateVerificationToken(): string {
    return `eco_${randomBytes(24).toString('base64url')}`;
  }

  private hashVerificationToken(raw: string): string {
    return `${HASH_PREFIX}${createHash('sha256').update(raw, 'utf8').digest('hex')}`;
  }

  /**
   * Compare a presented TXT value to the stored hash.
   * Legacy plaintext tokens (no sha256: prefix) are still accepted until rotated.
   */
  private tokenMatchesStoredHash(presented: string, stored: string): boolean {
    if (stored.startsWith(HASH_PREFIX)) {
      const presentedHash = this.hashVerificationToken(presented);
      const a = Buffer.from(presentedHash);
      const b = Buffer.from(stored);
      return a.length === b.length && timingSafeEqual(a, b);
    }
    const a = Buffer.from(presented);
    const b = Buffer.from(stored);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  private stripQuotes(value: string): string {
    return value.trim().replace(/^"(.*)"$/, '$1');
  }

  private toDto(
    domain: Domain,
    options?: { rawVerificationToken?: string },
  ) {
    const hostname = domain.hostname.toLowerCase();
    const challengeOpen =
      domain.type === DomainType.CUSTOM_DOMAIN &&
      CHALLENGE_STATUSES.includes(domain.status);
    const configured = Boolean(domain.verificationToken);
    const raw = options?.rawVerificationToken;

    return {
      id: domain.id,
      storeId: domain.storeId,
      hostname,
      type: domain.type,
      status: domain.status,
      isPrimary: domain.isPrimary,
      verifiedAt: domain.verifiedAt?.toISOString() ?? null,
      createdAt: domain.createdAt.toISOString(),
      updatedAt: domain.updatedAt.toISOString(),
      verificationConfigured: challengeOpen && configured,
      verification: challengeOpen
        ? {
            recordType: 'TXT' as const,
            recordName: verificationRecordName(hostname),
            // Secret only on create/regenerate responses — never hash/raw on GET.
            recordValue: raw ?? null,
            verificationConfigured: configured,
          }
        : null,
    };
  }
}
