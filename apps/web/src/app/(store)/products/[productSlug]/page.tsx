import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { PublicProductDetail } from '@ecomesta/types';
import { AddToCartPanel } from '@/components/add-to-cart-panel';
import { fetchPublicProduct } from '@/lib/catalog-lookup';
import { PublicApiError } from '@/lib/public-api';
import {
  requirePublicStore,
  storeCanonicalUrl,
  storeMetadataBase,
} from '@/lib/store-resolver';
import { resolvePageSeo, storeOgLocale, storePageRobots } from '@/lib/store-seo';
import { fetchPublicTheme } from '@/lib/theme';

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: { productSlug: string };
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<Metadata> {
  try {
    const { store } = await requirePublicStore(searchParams);
    const result = await fetchPublicProduct(store.slug, params.productSlug);
    const product = result.data;
    const configuration = await fetchPublicTheme(store.slug)
      .then((theme) => theme.configuration)
      .catch(() => null);
    const seo = resolvePageSeo({
      store,
      configuration,
      pageTitle: product.name,
      pageDescriptions: [product.shortDescription, product.description],
    });
    const path = `/products/${encodeURIComponent(params.productSlug)}`;
    const url = storeCanonicalUrl(path, store.slug);
    return {
      title: { absolute: seo.title },
      description: seo.description,
      metadataBase: storeMetadataBase(store.slug),
      alternates: url ? { canonical: url } : undefined,
      robots: storePageRobots(store, url),
      openGraph: {
        title: seo.title,
        description: seo.description,
        url,
        siteName: store.name,
        locale: storeOgLocale(store),
        images: product.images[0] ? [product.images[0].url] : undefined,
      },
    };
  } catch {
    return { title: 'Product' };
  }
}

export default async function ProductDetailPage({
  params,
  searchParams,
}: {
  params: { productSlug: string };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const { store } = await requirePublicStore(searchParams);
  let product: PublicProductDetail;
  try {
    const result = await fetchPublicProduct(store.slug, params.productSlug);
    product = result.data;
  } catch (err) {
    if (err instanceof PublicApiError && err.status === 404) {
      notFound();
    }
    throw err;
  }

  const image = product.images[0];

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[#e8efec]">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image.url}
            alt={image.alt || product.name}
            className="aspect-square w-full object-cover"
          />
        ) : (
          <div className="flex aspect-square items-center justify-center text-[var(--color-muted)]">
            No image
          </div>
        )}
      </div>
      <div className="space-y-6">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-tight">
            {product.name}
          </h1>
          {product.categories.length > 0 ? (
            <p className="mt-2 text-sm text-[var(--color-muted)]">
              {product.categories.map((c) => c.name).join(' · ')}
            </p>
          ) : null}
        </div>
        <AddToCartPanel product={product} />
        {product.description ? (
          <div className="prose prose-sm max-w-none text-[var(--color-ink)]">
            <h2 className="text-lg font-semibold">Description</h2>
            <p className="whitespace-pre-wrap text-[var(--color-muted)]">
              {product.description}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
