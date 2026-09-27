import Link from 'next/link';
import type { PublicCategory } from '@ecomesta/types';
import { withStoreParam } from '@/lib/theme';

export function FeaturedCategories({
  categories,
  storeSlug,
  title = 'Categories',
}: {
  categories: PublicCategory[];
  storeSlug: string;
  title?: string;
}) {
  if (categories.length === 0) {
    return null;
  }

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-semibold">{title}</h2>
      <ul className="flex flex-wrap gap-3">
        {categories.map((category) => (
          <li key={category.id}>
            <Link
              href={withStoreParam(`/categories/${category.slug}`, storeSlug)}
              className="inline-flex rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-sm hover:border-[var(--color-accent)]"
            >
              {category.name}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
