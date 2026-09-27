import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ContentPageView } from '@/components/marketing/content-page';
import {
  contentPath,
  findContentPage,
  pagesForHub,
  type ContentHub,
} from '@/lib/marketing/content';
import { buildMetadata } from '@/lib/marketing/seo';

type Params = { params: { slug: string } };

/** Shared static-route implementation for `/{hub}/[slug]` marketing pages. */
export function contentRoute(hub: ContentHub) {
  return {
    generateStaticParams() {
      return pagesForHub(hub).map((page) => ({ slug: page.slug }));
    },
    generateMetadata({ params }: Params): Metadata {
      const page = findContentPage(hub, params.slug);
      if (!page) {
        return {};
      }
      return buildMetadata({
        path: contentPath(page),
        title: page.title,
        description: page.description,
      });
    },
    Page({ params }: Params) {
      const page = findContentPage(hub, params.slug);
      if (!page) {
        notFound();
      }
      return <ContentPageView page={page} />;
    },
  };
}
