'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  Category,
  OffsetPageMeta,
  ProductDetail,
  ProductVariant,
} from '@ecomesta/types';
import { Button } from '@ecomesta/ui';
import {
  ProductForm,
  productToFormValues,
  type ProductFormValues,
} from '@/components/catalog/product-form';
import { ProductImageField } from '@/components/catalog/product-image-field';
import { StatusBadge } from '@/components/catalog/status-badge';
import { StoreScoped } from '@/components/catalog/store-scoped';
import {
  VariantForm,
  variantToFormValues,
  type VariantFormValues,
} from '@/components/catalog/variant-form';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { useToast } from '@/components/ui/toast';
import { ApiError, api } from '@/lib/api-client';
import { humanApiError } from '@/lib/catalog-utils';
import { useCanManageStore } from '@/lib/permissions';
import { useStoreContext } from '@/lib/store-context';

function toUpdateBody(values: ProductFormValues) {
  return {
    name: values.name.trim(),
    slug: values.slug,
    description: values.description.trim() || null,
    shortDescription: values.shortDescription.trim() || null,
    status: values.status,
    productType: values.productType,
    basePrice: values.basePrice.trim(),
    compareAtPrice: values.compareAtPrice.trim() || null,
    costPrice: values.costPrice.trim() || null,
    trackInventory: values.trackInventory,
    allowBackorder: values.allowBackorder,
    sku: values.sku.trim() || null,
    barcode: values.barcode.trim() || null,
    categoryIds: values.categoryIds,
  };
}

function toVariantBody(values: VariantFormValues) {
  return {
    name: values.name.trim(),
    sku: values.sku.trim() || undefined,
    barcode: values.barcode.trim() || undefined,
    price: values.price.trim(),
    compareAtPrice: values.compareAtPrice.trim() || null,
    costPrice: values.costPrice.trim() || null,
    weight: values.weight.trim() || null,
    status: values.status,
  };
}

function ProductDetailContent() {
  const params = useParams<{ productId: string }>();
  const productId = params.productId;
  const router = useRouter();
  const { selectedStoreId } = useStoreContext();
  const canWrite = useCanManageStore();
  const { pushToast } = useToast();

  const [product, setProduct] = useState<ProductDetail | null>(null);
  // Kept apart from `product` so an image change does not reset the form below.
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  // ProductForm resets its fields whenever `initial` changes identity.
  const formInitial = useMemo(
    () => (product ? productToFormValues(product) : undefined),
    [product],
  );
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [variantBusy, setVariantBusy] = useState(false);
  const [showCreateVariant, setShowCreateVariant] = useState(false);
  const [editingVariant, setEditingVariant] = useState<ProductVariant | null>(null);
  const [deleteVariantId, setDeleteVariantId] = useState<string | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);

  const load = useCallback(async () => {
    if (!selectedStoreId || !productId) {
      setProduct(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [productRes, categoriesRes] = await Promise.all([
        api.get<{ success: true; data: ProductDetail }>(
          `/stores/${selectedStoreId}/products/${productId}`,
        ),
        api.get<{
          success: true;
          data: { items: Category[]; meta: OffsetPageMeta };
        }>(`/stores/${selectedStoreId}/categories?limit=100`),
      ]);
      setProduct(productRes.data);
      setImageUrl(productRes.data.imageUrl ?? null);
      setCategories(categoriesRes.data.items);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setError('Product not found in this store.');
      } else if (err instanceof ApiError && err.status === 403) {
        setError('You do not have permission to view this product.');
      } else {
        setError(humanApiError(err, 'Failed to load product'));
      }
      setProduct(null);
    } finally {
      setLoading(false);
    }
  }, [selectedStoreId, productId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSave(values: ProductFormValues) {
    if (!selectedStoreId || !productId) return;
    setBusy(true);
    try {
      const result = await api.patch<{ success: true; data: ProductDetail }>(
        `/stores/${selectedStoreId}/products/${productId}`,
        toUpdateBody(values),
      );
      setProduct((prev) =>
        prev
          ? { ...prev, ...result.data, variants: prev.variants }
          : { ...result.data, variants: [] },
      );
      pushToast('Product updated.', 'success');
    } catch (err) {
      pushToast(humanApiError(err, 'Could not update product'), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function onArchive() {
    if (!selectedStoreId || !productId) return;
    setBusy(true);
    try {
      await api.delete(`/stores/${selectedStoreId}/products/${productId}`);
      pushToast('Product archived.', 'success');
      setArchiveOpen(false);
      router.push('/dashboard/products');
    } catch (err) {
      pushToast(humanApiError(err, 'Could not archive product'), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function onCreateVariant(values: VariantFormValues) {
    if (!selectedStoreId || !productId) return;
    setVariantBusy(true);
    try {
      await api.post(
        `/stores/${selectedStoreId}/products/${productId}/variants`,
        toVariantBody(values),
      );
      pushToast('Variant created.', 'success');
      setShowCreateVariant(false);
      await load();
    } catch (err) {
      pushToast(humanApiError(err, 'Could not create variant'), 'error');
    } finally {
      setVariantBusy(false);
    }
  }

  async function onUpdateVariant(values: VariantFormValues) {
    if (!selectedStoreId || !productId || !editingVariant) return;
    setVariantBusy(true);
    try {
      await api.patch(
        `/stores/${selectedStoreId}/products/${productId}/variants/${editingVariant.id}`,
        toVariantBody(values),
      );
      pushToast('Variant updated.', 'success');
      setEditingVariant(null);
      await load();
    } catch (err) {
      pushToast(humanApiError(err, 'Could not update variant'), 'error');
    } finally {
      setVariantBusy(false);
    }
  }

  async function onDeleteVariant() {
    if (!selectedStoreId || !productId || !deleteVariantId) return;
    setVariantBusy(true);
    try {
      await api.delete(
        `/stores/${selectedStoreId}/products/${productId}/variants/${deleteVariantId}`,
      );
      pushToast('Variant deleted.', 'success');
      setDeleteVariantId(null);
      await load();
    } catch (err) {
      pushToast(humanApiError(err, 'Could not delete variant'), 'error');
    } finally {
      setVariantBusy(false);
    }
  }

  if (!selectedStoreId) {
    return (
      <EmptyState
        title="Select a store"
        description="Choose a store from the header to manage this product."
      />
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/dashboard/products"
            className="text-sm text-[var(--color-accent)] hover:underline"
          >
            ← Products
          </Link>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl tracking-tight">
            {product?.name ?? 'Product'}
          </h1>
          {product ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusBadge status={product.status} />
              <span className="text-sm text-[var(--color-muted)]">{product.productType}</span>
            </div>
          ) : null}
          {product && canWrite ? (
            <p className="mt-2 text-sm text-[var(--color-muted)]">
              Edit the image, details, price and variants below. Click “Save changes” to update the product.
            </p>
          ) : null}
        </div>
        {canWrite && product && product.status !== 'ARCHIVED' ? (
          <Button variant="danger" onClick={() => setArchiveOpen(true)}>
            Archive
          </Button>
        ) : null}
      </div>

      {loading ? <LoadingState label="Loading product" /> : null}
      {!loading && error ? <ErrorState message={error} onRetry={() => void load()} /> : null}

      {!loading && !error && product ? (
        <>
          <ProductImageField
            storeId={selectedStoreId}
            product={{ id: product.id, name: product.name, imageUrl }}
            canWrite={canWrite}
            onChange={(updated) => setImageUrl(updated.imageUrl ?? null)}
          />

          {canWrite ? (
            <ProductForm
              key={product.updatedAt}
              initial={formInitial}
              categories={categories}
              busy={busy}
              submitLabel="Save changes"
              allowArchivedStatus
              onSubmit={onSave}
            />
          ) : (
            <EmptyState
              title="Read-only access"
              description="You can view this product, but editing requires manager access."
            />
          )}

          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">Variants</h2>
                <p className="text-sm text-[var(--color-muted)]">
                  Simple variants (no option matrix in this phase).
                </p>
              </div>
              {canWrite ? (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setEditingVariant(null);
                    setShowCreateVariant(true);
                  }}
                >
                  Add variant
                </Button>
              ) : null}
            </div>

            {showCreateVariant ? (
              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                <h3 className="mb-3 font-medium">New variant</h3>
                <VariantForm
                  busy={variantBusy}
                  submitLabel="Create variant"
                  onCancel={() => setShowCreateVariant(false)}
                  onSubmit={onCreateVariant}
                />
              </div>
            ) : null}

            {editingVariant ? (
              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                <h3 className="mb-3 font-medium">Edit variant</h3>
                <VariantForm
                  key={editingVariant.id}
                  initial={variantToFormValues(editingVariant)}
                  busy={variantBusy}
                  submitLabel="Update variant"
                  onCancel={() => setEditingVariant(null)}
                  onSubmit={onUpdateVariant}
                />
              </div>
            ) : null}

            {product.variants.length === 0 ? (
              <EmptyState
                title="No variants"
                description="Add a variant when this product needs SKU-level options."
              />
            ) : (
              <div className="overflow-x-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-[var(--color-border)] bg-[#f3f7f5] text-[var(--color-muted)]">
                    <tr>
                      <th className="px-4 py-3 font-medium">Name</th>
                      <th className="px-4 py-3 font-medium">SKU</th>
                      <th className="px-4 py-3 font-medium">Price</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {product.variants.map((variant) => (
                      <tr
                        key={variant.id}
                        className="border-b border-[var(--color-border)] last:border-b-0"
                      >
                        <td className="px-4 py-3 font-medium">{variant.name}</td>
                        <td className="px-4 py-3">{variant.sku ?? '—'}</td>
                        <td className="px-4 py-3">{variant.price}</td>
                        <td className="px-4 py-3">
                          <StatusBadge status={variant.status} />
                        </td>
                        <td className="px-4 py-3">
                          {canWrite ? (
                            <div className="flex flex-wrap gap-2">
                              <Button
                                variant="secondary"
                                onClick={() => {
                                  setShowCreateVariant(false);
                                  setEditingVariant(variant);
                                }}
                              >
                                Edit
                              </Button>
                              <Button
                                variant="danger"
                                onClick={() => setDeleteVariantId(variant.id)}
                              >
                                Delete
                              </Button>
                            </div>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : null}

      <ConfirmDialog
        open={archiveOpen}
        title="Archive this product?"
        description="The product will be marked ARCHIVED. It is not permanently deleted."
        confirmLabel="Archive"
        danger
        busy={busy}
        onCancel={() => setArchiveOpen(false)}
        onConfirm={() => void onArchive()}
      />

      <ConfirmDialog
        open={Boolean(deleteVariantId)}
        title="Delete this variant?"
        description="This removes the variant. Inventory must be zero if stock is tracked."
        confirmLabel="Delete"
        danger
        busy={variantBusy}
        onCancel={() => setDeleteVariantId(null)}
        onConfirm={() => void onDeleteVariant()}
      />
    </div>
  );
}

export default function ProductDetailPage() {
  return (
    <StoreScoped>
      <ProductDetailContent />
    </StoreScoped>
  );
}
