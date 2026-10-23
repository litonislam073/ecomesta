import { randomBytes } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { LandingPageStatus, Prisma, ProductStatus, StoreRole, type LandingPage } from '@prisma/client';
import type { Request } from 'express';
import {
  defaultLandingContent,
  isLandingTemplateKey,
  landingProductIds,
  landingSlugFrom,
  normalizeLandingContent,
  type LandingContent,
  type LandingPageDetail,
  type LandingPageSummary,
  type LandingTemplateKey,
} from '@ecomesta/utils';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { fireAndForget } from '../../common/utils/fire-and-forget.util';
import { AuditService } from '../audit/audit.service';
import { AuthorizationService } from '../authorization/authorization.service';
import { PlanEntitlementsService } from '../billing/plan-entitlements.service';
import type { CreateLandingPageDto, LandingPreviewDto, UpdateLandingPageDto } from './dto/landing-page.dto';

/** How long the storefront keeps showing the editor's unsaved draft. */
export const LANDING_PREVIEW_TTL_SECONDS = 2 * 60 * 60;
export const LANDING_PREVIEW_TOKEN_PATTERN = /^[A-Za-z0-9_-]{32}$/;

export function landingPreviewCacheKey(token: string): string {
  return `storefront:landing:preview:${token}`;
}

export interface StoredLandingPreview {
  storeId: string;
  pageId: string;
  userId: string;
  title: string;
  slug: string;
  template: LandingTemplateKey;
  content: LandingContent;
}

type PageWithCount = LandingPage & { _count?: { orders: number } };

@Injectable()
export class LandingPagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly authorization: AuthorizationService,
    private readonly audit: AuditService,
    private readonly entitlements: PlanEntitlementsService,
  ) {}

  async list(userId: string, storeId: string) {
    await this.authorization.assertStoreAccess(userId, storeId);
    await this.requireStore(storeId);
    const [pages, usage] = await Promise.all([
      this.prisma.landingPage.findMany({
        where: { storeId },
        orderBy: { updatedAt: 'desc' },
        include: { _count: { select: { orders: true } } },
      }),
      this.entitlements.landingPagesUsage(storeId),
    ]);
    return { success: true as const, data: { items: pages.map((p) => this.toSummary(p)), usage } };
  }

  async getOne(userId: string, storeId: string, pageId: string) {
    await this.authorization.assertStoreAccess(userId, storeId);
    const page = await this.requirePage(storeId, pageId);
    return { success: true as const, data: this.toDetail(page) };
  }

  async create(userId: string, storeId: string, dto: CreateLandingPageDto, req?: Request) {
    await this.authorization.assertStoreRole(userId, storeId, [StoreRole.STORE_MANAGER]);
    const store = await this.requireStore(storeId);
    const title = dto.title.trim();
    if (title.length < 2) throw new BadRequestException('Give the page a name');

    const page = await this.prisma.$transaction(async (tx) => {
      await this.entitlements.assertLandingPageCapacity(tx, storeId);
      const slug = dto.slug ?? (await this.freeSlug(tx, storeId, landingSlugFrom(title)));
      try {
        return await tx.landingPage.create({
          data: {
            storeId,
            title,
            slug,
            template: dto.template,
            content: defaultLandingContent(dto.template) as unknown as Prisma.InputJsonValue,
          },
          include: { _count: { select: { orders: true } } },
        });
      } catch (err) {
        throw this.slugConflict(err);
      }
    });

    fireAndForget(
      this.audit.log({
        action: 'LANDING_PAGE_CREATED',
        entityType: 'LandingPage',
        entityId: page.id,
        userId,
        tenantId: store.tenantId,
        storeId,
        metadata: { title: page.title, slug: page.slug, template: page.template },
        req,
      }),
      'landing page audit',
    );
    return { success: true as const, data: this.toDetail(page) };
  }

  /** Saves the draft (title, address, content); a published page keeps showing what was published. */
  async update(userId: string, storeId: string, pageId: string, dto: UpdateLandingPageDto, req?: Request) {
    await this.authorization.assertStoreRole(userId, storeId, [StoreRole.STORE_MANAGER]);
    const [store, page] = await Promise.all([
      this.requireStore(storeId),
      this.requirePage(storeId, pageId),
    ]);
    const template = this.templateOf(page);

    const data: Prisma.LandingPageUpdateInput = {};
    if (dto.title !== undefined) {
      const title = dto.title.trim();
      if (title.length < 2) throw new BadRequestException('Give the page a name');
      data.title = title;
    }
    if (dto.slug !== undefined) data.slug = dto.slug;
    if (dto.content !== undefined) {
      const content = normalizeLandingContent(template, dto.content);
      data.content = (await this.withStoreProducts(storeId, content)) as unknown as Prisma.InputJsonValue;
    }

    let updated: PageWithCount;
    try {
      updated = await this.prisma.landingPage.update({
        where: { id: page.id },
        data,
        include: { _count: { select: { orders: true } } },
      });
    } catch (err) {
      throw this.slugConflict(err);
    }

    if (dto.slug !== undefined && dto.slug !== page.slug) {
      fireAndForget(
        this.audit.log({
          action: 'LANDING_PAGE_UPDATED',
          entityType: 'LandingPage',
          entityId: page.id,
          userId,
          tenantId: store.tenantId,
          storeId,
          metadata: { slug: { from: page.slug, to: dto.slug } },
          req,
        }),
        'landing page audit',
      );
    }
    return { success: true as const, data: this.toDetail(updated) };
  }

  /** Makes the saved draft live. The page needs products that can be bought. */
  async publish(userId: string, storeId: string, pageId: string, req?: Request) {
    await this.authorization.assertStoreRole(userId, storeId, [StoreRole.STORE_MANAGER]);
    const [store, , page] = await Promise.all([
      this.requireStore(storeId),
      this.entitlements.assertFeature(storeId, 'landingPages'),
      this.requirePage(storeId, pageId),
    ]);
    const content = await this.withStoreProducts(storeId, normalizeLandingContent(this.templateOf(page), page.content));

    const active = await this.prisma.product.count({
      where: { storeId, id: { in: content.productIds }, status: ProductStatus.ACTIVE },
    });
    if (active === 0) {
      throw new UnprocessableEntityException({
        message: 'Choose at least one active product for this page before publishing it.',
        error: 'LANDING_PAGE_NO_PRODUCTS',
      });
    }

    const updated = await this.prisma.landingPage.update({
      where: { id: page.id },
      data: {
        status: LandingPageStatus.PUBLISHED,
        content: content as unknown as Prisma.InputJsonValue,
        publishedContent: content as unknown as Prisma.InputJsonValue,
        publishedAt: new Date(),
      },
      include: { _count: { select: { orders: true } } },
    });
    fireAndForget(
      this.audit.log({
        action: 'LANDING_PAGE_PUBLISHED',
        entityType: 'LandingPage',
        entityId: page.id,
        userId,
        tenantId: store.tenantId,
        storeId,
        metadata: { slug: page.slug },
        req,
      }),
      'landing page audit',
    );
    return { success: true as const, data: this.toDetail(updated) };
  }

  /** Takes the page offline; its link shows "not found" until it is published again. */
  async unpublish(userId: string, storeId: string, pageId: string, req?: Request) {
    await this.authorization.assertStoreRole(userId, storeId, [StoreRole.STORE_MANAGER]);
    const store = await this.requireStore(storeId);
    const page = await this.requirePage(storeId, pageId);
    const updated = await this.prisma.landingPage.update({
      where: { id: page.id },
      data: { status: LandingPageStatus.DRAFT, publishedContent: Prisma.DbNull, publishedAt: null },
      include: { _count: { select: { orders: true } } },
    });
    await this.audit.log({
      action: 'LANDING_PAGE_UNPUBLISHED',
      entityType: 'LandingPage',
      entityId: page.id,
      userId,
      tenantId: store.tenantId,
      storeId,
      metadata: { slug: page.slug },
      req,
    });
    return { success: true as const, data: this.toDetail(updated) };
  }

  /** Deletes the page. Its orders stay; they just no longer name the page. */
  async remove(userId: string, storeId: string, pageId: string, req?: Request) {
    await this.authorization.assertStoreRole(userId, storeId, [StoreRole.STORE_MANAGER]);
    const store = await this.requireStore(storeId);
    const page = await this.requirePage(storeId, pageId);
    await this.prisma.landingPage.delete({ where: { id: page.id } });
    await this.audit.log({
      action: 'LANDING_PAGE_DELETED',
      entityType: 'LandingPage',
      entityId: page.id,
      userId,
      tenantId: store.tenantId,
      storeId,
      metadata: { title: page.title, slug: page.slug },
      req,
    });
    return { success: true as const, data: { id: page.id } };
  }

  /**
   * The editor's live preview: the unsaved content is kept for a short time
   * under an unguessable token the storefront renders it for.
   */
  async preview(userId: string, storeId: string, pageId: string, dto: LandingPreviewDto) {
    await this.authorization.assertStoreRole(userId, storeId, [StoreRole.STORE_MANAGER]);
    const page = await this.requirePage(storeId, pageId);
    const content = await this.withStoreProducts(storeId, normalizeLandingContent(this.templateOf(page), dto.content));

    let token: string | null = null;
    if (dto.token && LANDING_PREVIEW_TOKEN_PATTERN.test(dto.token)) {
      const existing = await this.readPreview(dto.token);
      if (existing && existing.storeId === storeId && existing.pageId === page.id && existing.userId === userId) {
        token = dto.token;
      }
    }
    token ??= randomBytes(24).toString('base64url');

    const stored: StoredLandingPreview = {
      storeId,
      pageId: page.id,
      userId,
      title: page.title,
      slug: page.slug,
      template: this.templateOf(page),
      content,
    };
    await this.redis
      .getClient()
      .set(landingPreviewCacheKey(token), JSON.stringify(stored), 'EX', LANDING_PREVIEW_TTL_SECONDS);
    return {
      success: true as const,
      data: { token, expiresAt: new Date(Date.now() + LANDING_PREVIEW_TTL_SECONDS * 1000).toISOString() },
    };
  }

  async readPreview(token: string): Promise<StoredLandingPreview | null> {
    if (!LANDING_PREVIEW_TOKEN_PATTERN.test(token)) return null;
    try {
      const raw = await this.redis.getClient().get(landingPreviewCacheKey(token));
      return raw ? (JSON.parse(raw) as StoredLandingPreview) : null;
    } catch {
      return null;
    }
  }

  // ---------------------------------------------------------------------------

  /** Only products of this store (not archived) stay on the page. */
  private async withStoreProducts(storeId: string, content: LandingContent): Promise<LandingContent> {
    const ids = landingProductIds(content);
    if (ids.length === 0) return content;
    const rows = await this.prisma.product.findMany({
      where: { storeId, id: { in: ids }, status: { not: ProductStatus.ARCHIVED } },
      select: { id: true },
    });
    const known = new Set(rows.map((r) => r.id));
    return {
      ...content,
      productIds: content.productIds.filter((id) => known.has(id)),
      sections: content.sections.map((section) => ({
        ...section,
        settings: Object.fromEntries(
          Object.entries(section.settings).map(([key, value]) => [
            key,
            Array.isArray(value) && value.every((v) => typeof v === 'string')
              ? (value as string[]).filter((id) => known.has(id))
              : value,
          ]),
        ),
      })),
    };
  }

  private async freeSlug(tx: Prisma.TransactionClient, storeId: string, base: string): Promise<string> {
    const taken = new Set(
      (
        await tx.landingPage.findMany({
          where: { storeId, slug: { startsWith: base } },
          select: { slug: true },
        })
      ).map((p) => p.slug),
    );
    if (!taken.has(base)) return base;
    for (let n = 2; n < 1000; n += 1) {
      const candidate = `${base.slice(0, 74)}-${n}`;
      if (!taken.has(candidate)) return candidate;
    }
    return `${base.slice(0, 60)}-${randomBytes(4).toString('hex')}`;
  }

  private slugConflict(err: unknown): unknown {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return new ConflictException({
        message: 'Another landing page of this store already uses this address.',
        error: 'LANDING_PAGE_SLUG_TAKEN',
      });
    }
    return err;
  }

  private templateOf(page: LandingPage): LandingTemplateKey {
    if (!isLandingTemplateKey(page.template)) throw new NotFoundException('Landing page not found');
    return page.template;
  }

  private async requireStore(storeId: string) {
    const store = await this.prisma.store.findUnique({ where: { id: storeId }, select: { id: true, tenantId: true } });
    if (!store) throw new NotFoundException('Store not found');
    return store;
  }

  private async requirePage(storeId: string, pageId: string): Promise<PageWithCount> {
    const page = await this.prisma.landingPage.findFirst({
      where: { id: pageId, storeId },
      include: { _count: { select: { orders: true } } },
    });
    if (!page) throw new NotFoundException('Landing page not found');
    return page;
  }

  private toSummary(page: PageWithCount): LandingPageSummary {
    const template = this.templateOf(page);
    const published = page.status === LandingPageStatus.PUBLISHED;
    return {
      id: page.id,
      storeId: page.storeId,
      title: page.title,
      slug: page.slug,
      template,
      status: page.status,
      hasUnpublishedChanges:
        published && JSON.stringify(page.content) !== JSON.stringify(page.publishedContent),
      publishedAt: page.publishedAt?.toISOString() ?? null,
      createdAt: page.createdAt.toISOString(),
      updatedAt: page.updatedAt.toISOString(),
      orderCount: page._count?.orders ?? 0,
    };
  }

  private toDetail(page: PageWithCount): LandingPageDetail {
    return { ...this.toSummary(page), content: normalizeLandingContent(this.templateOf(page), page.content) };
  }
}
