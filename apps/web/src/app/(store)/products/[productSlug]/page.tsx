import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { PublicProductDetail } from '@ecomesta/types';
import { AddToCartPanel } from '@/components/add-to-cart-panel';
import { publicGet, PublicApiError } from '@/lib/public-api';
import { requirePublicStore } from '@/lib/store-resolver';

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: { productSlug: string };
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<Metadata> {
  try {
    const { store } = await requirePublicStore(searchParams);
    const result = await publicGet<{ success: true; data: PublicProductDetail }>(
      `/public/stores/${store.slug}/products/${encodeURIComponent(params.productSlug)}`,
    );
    const product = result.data;
    return {
      title: `${product.name} · ${store.name}`,
      description: product.shortDescription ?? product.description ?? product.name,
      openGraph: {
        title: product.name,
        description: product.shortDescription ?? undefined,
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
    const result = await publicGet<{ success: true; data: PublicProductDetail }>(
      `/public/stores/${store.slug}/products/${encodeURIComponent(params.productSlug)}`,
    );
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
