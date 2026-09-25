'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { Category, OffsetPageMeta, Product } from '@ecomesta/types';
import { Button } from '@ecomesta/ui';
import {
  ProductForm,
  type ProductFormValues,
} from '@/components/catalog/product-form';
import { StoreScoped } from '@/components/catalog/store-scoped';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api-client';
import { humanApiError } from '@/lib/catalog-utils';
import { useCanManageStore } from '@/lib/permissions';
import { useStoreContext } from '@/lib/store-context';

function toCreateBody(values: ProductFormValues) {
  return {
    name: values.name.trim(),
    slug: values.slug,
    description: values.description.trim() || undefined,
    shortDescription: values.shortDescription.trim() || undefined,
    status: values.status === 'ARCHIVED' ? 'DRAFT' : values.status,
    productType: values.productType,
    basePrice: values.basePrice.trim(),
    compareAtPrice: values.compareAtPrice.trim() || null,
    costPrice: values.costPrice.trim() || null,
    trackInventory: values.trackInventory,
    allowBackorder: values.allowBackorder,
    sku: values.sku.trim() || undefined,
    barcode: values.barcode.trim() || undefined,
    categoryIds: values.categoryIds,
  };
}

function NewProductContent() {
  const router = useRouter();
  const { selectedStoreId } = useStoreContext();
  const canWrite = useCanManageStore();
  const { pushToast } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadCategories = useCallback(async () => {
    if (!selectedStoreId) {
      setCategories([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await api.get<{
        success: true;
        data: { items: Category[]; meta: OffsetPageMeta };
      }>(`/stores/${selectedStoreId}/categories?limit=100`);
      setCategories(result.data.items);
    } catch (err) {
      setError(humanApiError(err, 'Failed to load categories'));
    } finally {
      setLoading(false);
    }
  }, [selectedStoreId]);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  async function onSubmit(values: ProductFormValues) {
    if (!selectedStoreId) return;
    setBusy(true);
    try {
      const result = await api.post<{ success: true; data: Product }>(
        `/stores/${selectedStoreId}/products`,
        toCreateBody(values),
      );
      pushToast('Product created.', 'success');
      router.push(`/dashboard/products/${result.data.id}`);
    } catch (err) {
      pushToast(humanApiError(err, 'Could not create product'), 'error');
    } finally {
      setBusy(false);
    }
  }

  if (!selectedStoreId) {
    return (
      <EmptyState
        title="Select a store"
        description="Choose a store from the header before creating a product."
      />
    );
  }

  if (!canWrite) {
    return (
      <EmptyState
        title="Permission required"
        description="You can view the catalog, but creating products requires manager access."
        actionLabel="Back to products"
        onAction={() => router.push('/dashboard/products')}
      />
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight">
            Add product
          </h1>
          <p className="mt-2 text-[var(--color-muted)]">
            Creates a product in the selected store via the catalog API.
          </p>
        </div>
        <Link href="/dashboard/products">
          <Button variant="secondary">Back</Button>
        </Link>
      </div>

      {loading ? <LoadingState label="Loading form" /> : null}
      {!loading && error ? (
        <ErrorState message={error} onRetry={() => void loadCategories()} />
      ) : null}
      {!loading && !error ? (
        <ProductForm
          categories={categories}
          busy={busy}
          submitLabel="Create product"
          onSubmit={onSubmit}
        />
      ) : null}
    </div>
  );
}

export default function NewProductPage() {
  return (
    <StoreScoped>
      <NewProductContent />
    </StoreScoped>
  );
}
