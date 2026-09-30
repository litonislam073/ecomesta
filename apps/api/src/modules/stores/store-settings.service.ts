import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DomainStatus,
  DomainType,
  Prisma,
  StoreRole,
} from '@prisma/client';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthorizationService } from '../authorization/authorization.service';
import { StoreDomainResolver } from '../domains/store-domain.resolver';
import { LIVE_STORE_THEME_ORDER, liveStoreThemeWhere } from '../themes/theme-live';
import {
  UpdateStoreSettingsDto,
  languageForLocale,
  localeForLanguage,
} from './dto/store-settings.dto';

const SETTINGS_SELECT = {
  id: true,
  tenantId: true,
  name: true,
  slug: true,
  status: true,
  description: true,
  email: true,
  phone: true,
  address: true,
  currency: true,
  timezone: true,
  locale: true,
  logoUrl: true,
  faviconUrl: true,
  checkoutRequirePhone: true,
  checkoutAllowOrderNotes: true,
  allowCustomerCancellation: true,
  seoTitle: true,
  seoDescription: true,
  seoKeywords: true,
  ogTitle: true,
  ogDescription: true,
  ogImageUrl: true,
  seoIndexingEnabled: true,
  createdAt: true,
  updatedAt: true,
  tenant: { select: { name: true } },
} satisfies Prisma.StoreSelect;

type SettingsRow = Prisma.StoreGetPayload<{ select: typeof SETTINGS_SELECT }>;

/** Editable columns, grouped for audit metadata. */
const FIELD_GROUPS = {
  name: 'general',
  description: 'general',
  email: 'general',
  phone: 'general',
  address: 'general',
  locale: 'general',
  checkoutRequirePhone: 'checkout',
  checkoutAllowOrderNotes: 'checkout',
  allowCustomerCancellation: 'orders',
  seoTitle: 'seo',
  seoDescription: 'seo',
  seoKeywords: 'seo',
  ogTitle: 'seo',
  ogDescription: 'seo',
  ogImageUrl: 'seo',
  seoIndexingEnabled: 'seo',
} as const;

type EditableField = keyof typeof FIELD_GROUPS;
type EditableValues = Partial<Pick<SettingsRow, EditableField>>;

const AUDIT_VALUE_MAX = 200;

/** Statuses a guest may cancel from when customer cancellation is enabled. */
export const CUSTOMER_CANCELLABLE_STATUSES = ['PENDING', 'CONFIRMED'] as const;

@Injectable()
export class StoreSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
    private readonly audit: AuditService,
    private readonly domains: StoreDomainResolver,
  ) {}

  async get(userId: string, storeId: string) {
    await this.authorization.assertStoreAccess(userId, storeId);
    const store = await this.requireStore(storeId);
    const canEdit = await this.canEdit(userId, storeId);
    return { success: true as const, data: this.toDto(store, canEdit) };
  }

  async update(
    userId: string,
    storeId: string,
    dto: UpdateStoreSettingsDto,
    req?: Request,
  ) {
    await this.authorization.assertStoreRole(userId, storeId, [
      StoreRole.STORE_MANAGER,
    ]);
    const current = await this.requireStore(storeId);

    if (
      dto.expectedUpdatedAt &&
      new Date(dto.expectedUpdatedAt).getTime() !== current.updatedAt.getTime()
    ) {
      throw this.staleConflict();
    }

    const requested = this.editableValues(dto);
    const changes = this.diff(current, requested);
    const changedFields = Object.keys(changes) as EditableField[];

    if (changedFields.length === 0) {
      return { success: true as const, data: this.toDto(current, true) };
    }

    const data: Prisma.StoreUpdateManyMutationInput = {};
    for (const field of changedFields) {
      (data as Record<string, unknown>)[field] = requested[field];
    }

    // Conditional on the row we just read so a concurrent save is not overwritten.
    const { count } = await this.prisma.store.updateMany({
      where: { id: storeId, updatedAt: current.updatedAt },
      data,
    });
    if (count === 0) {
      throw this.staleConflict();
    }
    const updated = await this.requireStore(storeId);

    await this.audit.log({
      action: 'STORE_SETTINGS_UPDATED',
      entityType: 'Store',
      entityId: storeId,
      userId,
      tenantId: current.tenantId,
      storeId,
      metadata: {
        changedFields,
        groups: Array.from(new Set(changedFields.map((f) => FIELD_GROUPS[f]))),
        changes: this.auditChanges(changes),
      } as Prisma.InputJsonValue,
      req,
    });

    // Cached host resolutions embed store data; drop them so the next public
    // request sees the saved settings.
    await this.domains.invalidateStore(storeId);

    return { success: true as const, data: this.toDto(updated, true) };
  }

  /** Read-only summary for the settings overview (no secrets, no tokens). */
  async summary(userId: string, storeId: string) {
    await this.authorization.assertStoreAccess(userId, storeId);
    const store = await this.requireStore(storeId);

    const [providers, shippingMethods, shippingZones, domains, activeTheme] =
      await Promise.all([
        this.prisma.paymentProviderConfig.findMany({
          where: { storeId, enabled: true },
          select: { provider: true, mode: true },
          orderBy: { provider: 'asc' },
        }),
        this.prisma.shippingMethod.findMany({
          where: { storeId },
          select: { active: true, codAllowed: true },
        }),
        this.prisma.shippingZone.count({ where: { storeId } }),
        this.prisma.domain.findMany({
          where: { storeId },
          select: { hostname: true, type: true, status: true, isPrimary: true },
        }),
        // Live theme, not the merchant's unpublished selection.
        this.prisma.storeTheme.findFirst({
          where: liveStoreThemeWhere(storeId),
          orderBy: LIVE_STORE_THEME_ORDER,
          select: {
            publishedAt: true,
            publishedConfiguration: true,
            theme: { select: { name: true } },
          },
        }),
      ]);

    const platform = domains.find((d) => d.type === DomainType.SUBDOMAIN);
    const custom = domains.filter((d) => d.type === DomainType.CUSTOM_DOMAIN);
    const primary = domains.find(
      (d) => d.isPrimary && d.status === DomainStatus.ACTIVE,
    );
    const branding = this.publishedBranding(activeTheme?.publishedConfiguration);

    return {
      success: true as const,
      data: {
        payments: {
          offlineMethods: ['COD', 'BANK_TRANSFER', 'OTHER'],
          onlineProviders: providers.map((p) => ({
            provider: p.provider,
            mode: p.mode === 'live' ? 'live' : 'test',
          })),
        },
        shipping: {
          methodCount: shippingMethods.length,
          activeMethodCount: shippingMethods.filter((m) => m.active).length,
          codMethodCount: shippingMethods.filter((m) => m.active && m.codAllowed)
            .length,
          zoneCount: shippingZones,
        },
        domains: {
          platformHostname: platform?.hostname ?? null,
          primaryHostname:
            primary?.hostname ?? (await this.domains.canonicalHostname(store)),
          customDomainCount: custom.length,
          activeCustomDomainCount: custom.filter(
            (d) => d.status === DomainStatus.ACTIVE,
          ).length,
          pendingCustomDomainCount: custom.filter(
            (d) =>
              d.status === DomainStatus.PENDING ||
              d.status === DomainStatus.VERIFIED,
          ).length,
        },
        theme: {
          name: activeTheme?.theme.name ?? null,
          publishedAt: activeTheme?.publishedAt ?? null,
          logoUrl: branding.logoUrl ?? store.logoUrl,
          faviconUrl: branding.faviconUrl ?? store.faviconUrl,
        },
      },
    };
  }

  // ---------------------------------------------------------------------------

  private async requireStore(storeId: string): Promise<SettingsRow> {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      select: SETTINGS_SELECT,
    });
    if (!store) {
      throw new NotFoundException('Store not found');
    }
    return store;
  }

  private canEdit(userId: string, storeId: string): Promise<boolean> {
    return this.authorization.hasStoreRole(userId, storeId, [
      StoreRole.STORE_MANAGER,
    ]);
  }

  private staleConflict() {
    return new ConflictException(
      'These settings were changed by someone else. Reload to see the latest values, then save again.',
    );
  }

  private editableValues(dto: UpdateStoreSettingsDto): EditableValues {
    const values: EditableValues = {};
    const copy = <K extends EditableField>(field: K, value: EditableValues[K]) => {
      if (value !== undefined) {
        values[field] = value;
      }
    };
    copy('name', dto.name);
    copy('description', dto.description);
    copy('email', dto.email?.toLowerCase() ?? dto.email);
    copy('phone', dto.phone);
    copy('address', dto.address);
    if (dto.defaultLanguage !== undefined) {
      values.locale = localeForLanguage(dto.defaultLanguage);
    }
    copy('checkoutRequirePhone', dto.checkoutRequirePhone);
    copy('checkoutAllowOrderNotes', dto.checkoutAllowOrderNotes);
    copy('allowCustomerCancellation', dto.allowCustomerCancellation);
    copy('seoTitle', dto.seoTitle);
    copy('seoDescription', dto.seoDescription);
    if (dto.seoKeywords !== undefined) {
      values.seoKeywords = Array.from(
        new Set(dto.seoKeywords.filter((keyword) => keyword.length > 0)),
      );
    }
    copy('ogTitle', dto.ogTitle);
    copy('ogDescription', dto.ogDescription);
    copy('ogImageUrl', dto.ogImageUrl);
    copy('seoIndexingEnabled', dto.seoIndexingEnabled);
    return values;
  }

  private diff(current: SettingsRow, requested: EditableValues) {
    const changes: Partial<Record<EditableField, { from: unknown; to: unknown }>> = {};
    for (const [field, to] of Object.entries(requested) as [EditableField, unknown][]) {
      const from = current[field];
      const same = Array.isArray(from)
        ? JSON.stringify(from) === JSON.stringify(to)
        : from === to;
      if (!same) {
        changes[field] = { from, to };
      }
    }
    return changes;
  }

  private auditChanges(
    changes: Partial<Record<EditableField, { from: unknown; to: unknown }>>,
  ) {
    const clip = (value: unknown) =>
      typeof value === 'string' && value.length > AUDIT_VALUE_MAX
        ? `${value.slice(0, AUDIT_VALUE_MAX)}…`
        : value ?? null;
    return Object.fromEntries(
      Object.entries(changes).map(([field, change]) => [
        field,
        { from: clip(change!.from), to: clip(change!.to) },
      ]),
    );
  }

  private publishedBranding(configuration: Prisma.JsonValue | undefined): {
    logoUrl?: string;
    faviconUrl?: string;
  } {
    if (!configuration || typeof configuration !== 'object' || Array.isArray(configuration)) {
      return {};
    }
    const branding = (configuration as Record<string, unknown>).branding;
    if (!branding || typeof branding !== 'object' || Array.isArray(branding)) {
      return {};
    }
    const { logoUrl, faviconUrl } = branding as Record<string, unknown>;
    return {
      logoUrl: typeof logoUrl === 'string' && logoUrl ? logoUrl : undefined,
      faviconUrl: typeof faviconUrl === 'string' && faviconUrl ? faviconUrl : undefined,
    };
  }

  private toDto(store: SettingsRow, canEdit: boolean) {
    return {
      storeId: store.id,
      name: store.name,
      slug: store.slug,
      status: store.status,
      businessName: store.tenant.name,
      description: store.description,
      email: store.email,
      phone: store.phone,
      address: store.address,
      currency: store.currency,
      timezone: store.timezone,
      defaultLanguage: languageForLocale(store.locale),
      locale: store.locale,
      checkoutRequirePhone: store.checkoutRequirePhone,
      checkoutAllowOrderNotes: store.checkoutAllowOrderNotes,
      allowCustomerCancellation: store.allowCustomerCancellation,
      seoTitle: store.seoTitle,
      seoDescription: store.seoDescription,
      seoKeywords: store.seoKeywords,
      ogTitle: store.ogTitle,
      ogDescription: store.ogDescription,
      ogImageUrl: store.ogImageUrl,
      seoIndexingEnabled: store.seoIndexingEnabled,
      /** Behaviour the platform enforces for every store today. */
      fixed: {
        guestCheckout: true,
        requireEmail: true,
        requireShippingAddress: true,
        currencyEditable: false,
        timezoneEditable: false,
        slugEditable: false,
        customerCancellableStatuses: [...CUSTOMER_CANCELLABLE_STATUSES],
      },
      permissions: { canEdit },
      createdAt: store.createdAt,
      updatedAt: store.updatedAt,
    };
  }
}
