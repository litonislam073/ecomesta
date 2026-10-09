'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { Category, ProductStatus } from '@ecomesta/types';
import { Button } from '@ecomesta/ui';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { isValidSlug, normalizeSlug, slugifyFromName } from '@/lib/catalog-utils';

export type CategoryFormValues = {
  name: string;
  slug: string;
  description: string;
  parentId: string;
  status: ProductStatus;
};

function collectDescendantIds(rootId: string, all: Category[]): Set<string> {
  const byParent = new Map<string | null, Category[]>();
  for (const cat of all) {
    const key = cat.parentId;
    const list = byParent.get(key) ?? [];
    list.push(cat);
    byParent.set(key, list);
  }
  const banned = new Set<string>([rootId]);
  const stack = [rootId];
  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const child of byParent.get(current) ?? []) {
      if (!banned.has(child.id)) {
        banned.add(child.id);
        stack.push(child.id);
      }
    }
  }
  return banned;
}

export function CategoryForm({
  initial,
  categories,
  editingId,
  busy,
  submitLabel,
  onSubmit,
}: {
  initial?: Partial<CategoryFormValues>;
  categories: Category[];
  editingId?: string;
  busy?: boolean;
  submitLabel: string;
  onSubmit: (values: CategoryFormValues) => Promise<void> | void;
}) {
  const [values, setValues] = useState<CategoryFormValues>({
    name: initial?.name ?? '',
    slug: initial?.slug ?? '',
    description: initial?.description ?? '',
    parentId: initial?.parentId ?? '',
    status: initial?.status ?? 'ACTIVE',
  });
  const [slugTouched, setSlugTouched] = useState(Boolean(initial?.slug));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initial) {
      setValues({
        name: initial.name ?? '',
        slug: initial.slug ?? '',
        description: initial.description ?? '',
        parentId: initial.parentId ?? '',
        status: initial.status ?? 'ACTIVE',
      });
      setSlugTouched(Boolean(initial.slug));
    }
  }, [initial]);

  const bannedParents = useMemo(
    () => (editingId ? collectDescendantIds(editingId, categories) : new Set<string>()),
    [editingId, categories],
  );

  const parentOptions = categories.filter((cat) => !bannedParents.has(cat.id));

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!values.name.trim()) {
      setError('Name is required.');
      return;
    }
    const slug = normalizeSlug(values.slug);
    if (!isValidSlug(slug)) {
      setError('Slug must be lowercase letters, numbers, and hyphens (2–64 chars).');
      return;
    }
    if (editingId && values.parentId === editingId) {
      setError('A category cannot be its own parent.');
      return;
    }
    if (values.parentId && bannedParents.has(values.parentId)) {
      setError('A category cannot use one of its descendants as parent.');
      return;
    }
    await onSubmit({ ...values, slug });
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 md:grid-cols-2" noValidate>
      <label className="space-y-1 text-sm">
        <span>Name</span>
        <Input
          required
          value={values.name}
          onChange={(e) => {
            const name = e.target.value;
            setValues((v) => ({
              ...v,
              name,
              slug: slugTouched ? v.slug : slugifyFromName(name),
            }));
          }}
        />
      </label>
      <label className="space-y-1 text-sm">
        <span>Slug</span>
        <Input
          required
          value={values.slug}
          onChange={(e) => {
            setSlugTouched(true);
            setValues((v) => ({ ...v, slug: e.target.value }));
          }}
        />
      </label>
      <label className="space-y-1 text-sm md:col-span-2">
        <span>Description</span>
        <Input
          value={values.description}
          onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
        />
      </label>
      <label className="space-y-1 text-sm">
        <span>Parent</span>
        <Select
          value={values.parentId}
          onChange={(e) => setValues((v) => ({ ...v, parentId: e.target.value }))}
        >
          <option value="">None (root)</option>
          {parentOptions.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </Select>
      </label>
      <label className="space-y-1 text-sm">
        <span>Status</span>
        <Select
          value={values.status}
          onChange={(e) =>
            setValues((v) => ({ ...v, status: e.target.value as ProductStatus }))
          }
        >
          <option value="ACTIVE">ACTIVE</option>
          <option value="DRAFT">DRAFT</option>
          <option value="ARCHIVED">ARCHIVED</option>
        </Select>
      </label>
      {error ? (
        <p className="md:col-span-2 text-sm text-[var(--color-danger)]" role="alert">
          {error}
        </p>
      ) : null}
      <div className="md:col-span-2">
        <Button type="submit" disabled={busy}>
          {busy ? 'Saving…' : submitLabel}
        </Button>
      </div>
    </form>
  );
}
