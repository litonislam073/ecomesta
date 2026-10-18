import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { MarketingLocale } from '@ecomesta/ui/marketing';
import { ContentPageView, localizedContentPath } from '@/components/marketing/content-page';
import { findContentPage, pagesForHub, type ContentHub } from '@/lib/marketing/content';
import { buildMetadata } from '@/lib/marketing/seo';

type Params = { params: { slug: string } };

/** Shared static-route implementation for `/{hub}/[slug]` and `/bn/{hub}/[slug]` marketing pages. */
export function contentRoute(hub: ContentHub, locale: MarketingLocale = 'en') {
  return {
    generateStaticParams() {
      return pagesForHub(hub, locale).map((page) => ({ slug: page.slug }));
    },
    generateMetadata({ params }: Params): Metadata {
      const page = findContentPage(hub, params.slug, locale);
      if (!page) {
        return {};
      }
      return buildMetadata({
        path: localizedContentPath(page, locale),
        locale,
        title: page.title,
        description: page.description,
      });
    },
    Page({ params }: Params) {
      const page = findContentPage(hub, params.slug, locale);
      if (!page) {
        notFound();
      }
      return <ContentPageView page={page} locale={locale} />;
    },
  };
}
