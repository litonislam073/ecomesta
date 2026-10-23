import type { Metadata } from 'next';
import Link from 'next/link';
import type { PublicCategory } from '@ecomesta/types';
import { publicGet } from '@/lib/public-api';
import {
  requirePublicStore,
  storeCanonicalUrl,
  storeMetadataBase,
} from '@/lib/store-resolver';
import { resolvePageSeo, storeOgLocale, storePageRobots } from '@/lib/store-seo';
import { fetchStoreTheme } from '@/lib/theme-server';
import { withStoreParam } from '@/lib/theme';

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<Metadata> {
  try {
    const { store } = await requirePublicStore(searchParams);
    const configuration = await fetchStoreTheme(store.slug)
      .then((theme) => theme.configuration)
      .catch(() => null);
    const seo = resolvePageSeo({
      store,
      configuration,
      pageTitle: 'Categories',
      pageDescriptions: ['Browse product categories'],
    });
    const url = storeCanonicalUrl('/categories', store.slug);
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
      },
    };
  } catch {
    return { title: 'Categories' };
  }
}

export default async function CategoriesIndexPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const { store, storeSlug } = await requirePublicStore(searchParams);
  const categoriesRes = await publicGet<{
    success: true;
    data: { items: PublicCategory[] };
  }>(`/public/stores/${store.slug}/categories`);
  const categories = categoriesRes.data.items;

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-10">
      <header className="space-y-2">
        <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight text-[var(--color-ink)]">
          Categories
        </h1>
        <p className="text-[var(--color-muted)]">
          Browse all categories in {store.name}.
        </p>
      </header>

      {categories.length === 0 ? (
        <p className="text-[var(--color-muted)]">No categories yet.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => (
            <li key={category.id}>
              <Link
                href={withStoreParam(
                  `/categories/${encodeURIComponent(category.slug)}`,
                  storeSlug,
                )}
                className="flex flex-col gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 transition hover:border-[var(--color-accent)]"
              >
                {category.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={category.imageUrl}
                    alt=""
                    className="h-36 w-full rounded-md object-cover"
                  />
                ) : null}
                <span className="font-semibold text-[var(--color-ink)]">
                  {category.name}
                </span>
                {category.description ? (
                  <span className="line-clamp-2 text-sm text-[var(--color-muted)]">
                    {category.description}
                  </span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
