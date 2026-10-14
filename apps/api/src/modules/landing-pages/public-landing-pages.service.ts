import { Injectable, NotFoundException } from '@nestjs/common';
import { LandingPageStatus } from '@prisma/client';
import { isLandingTemplateKey, landingProductIds, normalizeLandingContent, type LandingContent } from '@ecomesta/utils';
import { PrismaService } from '../../prisma/prisma.service';
import { PlanEntitlementsService } from '../billing/plan-entitlements.service';
import { PublicStorefrontService } from '../public-storefront/public-storefront.service';
import { LandingPagesService } from './landing-pages.service';

@Injectable()
export class PublicLandingPagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storefront: PublicStorefrontService,
    private readonly entitlements: PlanEntitlementsService,
    private readonly landingPages: LandingPagesService,
  ) {}

  /**
   * A published landing page with the products it sells. With the editor's
   * preview token the unsaved draft is shown instead (also before publishing).
   * Pages of a store whose plan no longer includes landing pages are not found.
   */
  async getPage(storeSlug: string, pageSlug: string, previewToken?: string) {
    const store = await this.storefront.requireActiveStore(storeSlug);

    let page: { id: string; title: string; slug: string; template: string; content: LandingContent } | null = null;
    let preview = false;
    if (previewToken) {
      const stored = await this.landingPages.readPreview(previewToken);
      if (stored && stored.storeId === store.id) {
        page = { id: stored.pageId, title: stored.title, slug: stored.slug, template: stored.template, content: stored.content };
        preview = true;
      }
    }

    if (!page) {
      const row = await this.prisma.landingPage.findFirst({
        where: { storeId: store.id, slug: pageSlug.trim().toLowerCase(), status: LandingPageStatus.PUBLISHED },
      });
      if (!row || !row.publishedContent || !isLandingTemplateKey(row.template)) {
        throw new NotFoundException('Landing page not found');
      }
      if (!(await this.entitlements.storeHasFeature(store.id, 'landingPages'))) {
        throw new NotFoundException('Landing page not found');
      }
      page = {
        id: row.id,
        title: row.title,
        slug: row.slug,
        template: row.template,
        content: normalizeLandingContent(row.template, row.publishedContent),
      };
    }

    const products = await this.storefront.productDetailsByIds(store.id, store.currency, landingProductIds(page.content));
    return {
      success: true as const,
      data: { ...page, currency: store.currency, products, preview },
    };
  }
}
