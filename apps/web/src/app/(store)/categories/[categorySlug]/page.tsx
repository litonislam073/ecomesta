import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type {
  OffsetPageMeta,
  PublicCategory,
  PublicProductCard,
} from '@ecomesta/types';
import { ProductCard } from '@/components/product-card';
import { publicGet, PublicApiError } from '@/lib/public-api';
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
  params: { categorySlug: string };
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<Metadata> {
  try {
    const { store } = await requirePublicStore(searchParams);
    const result = await publicGet<{ success: true; data: PublicCategory }>(
      `/public/stores/${store.slug}/categories/${encodeURIComponent(params.categorySlug)}`,
    );
    const category = result.data;
    const configuration = await fetchPublicTheme(store.slug)
      .then((theme) => theme.configuration)
      .catch(() => null);
    const seo = resolvePageSeo({
      store,
      configuration,
      pageTitle: category.name,
      pageDescriptions: [category.description],
    });
    const url = storeCanonicalUrl(
      `/categories/${encodeURIComponent(params.categorySlug)}`,
      store.slug,
    );
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
        images: category.imageUrl ? [category.imageUrl] : undefined,
      },
    };
  } catch {
    return { title: 'Category' };
  }
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: { categorySlug: string };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const { store, storeSlug } = await requirePublicStore(searchParams);

  let category: PublicCategory;
  try {
    const result = await publicGet<{ success: true; data: PublicCategory }>(
      `/public/stores/${store.slug}/categories/${encodeURIComponent(params.categorySlug)}`,
    );
    category = result.data;
  } catch (err) {
    if (err instanceof PublicApiError && err.status === 404) {
      notFound();
    }
    throw err;
  }

  const products = await publicGet<{
    success: true;
    data: { items: PublicProductCard[]; meta: OffsetPageMeta };
  }>(
    `/public/stores/${store.slug}/products?categorySlug=${encodeURIComponent(params.categorySlug)}&limit=24`,
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-tight">
          {category.name}
        </h1>
        {category.description ? (
          <p className="mt-2 max-w-2xl text-[var(--color-muted)]">{category.description}</p>
        ) : null}
      </div>

      {products.data.items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-16 text-center text-[var(--color-muted)]">
          No products in this category yet.
        </p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {products.data.items.map((product) => (
            <ProductCard key={product.id} product={product} storeSlug={storeSlug} />
          ))}
        </div>
      )}
    </div>
  );
}
