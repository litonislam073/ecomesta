'use client';

import { useMemo, useState } from 'react';
import type { Category } from '@ecomesta/types';
import { Button } from '@ecomesta/ui';
import { StatusBadge } from '@/components/catalog/status-badge';

type TreeNode = Omit<Category, 'children'> & { children: TreeNode[] };

function buildTree(items: Category[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  for (const item of items) {
    const { children: _ignored, ...rest } = item;
    map.set(item.id, { ...rest, children: [] });
  }
  const roots: TreeNode[] = [];
  for (const node of map.values()) {
    if (node.parentId && map.has(node.parentId)) {
      map.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

function TreeBranch({
  node,
  depth,
  canWrite,
  onEdit,
  onDelete,
}: {
  node: TreeNode;
  depth: number;
  canWrite: boolean;
  onEdit: (category: Category) => void;
  onDelete: (category: Category) => void;
}) {
  const [open, setOpen] = useState(true);
  const hasChildren = node.children.length > 0;

  return (
    <li>
      <div
        className="flex flex-wrap items-center justify-between gap-2 rounded-md px-2 py-2 hover:bg-[#eef4f1]"
        style={{ paddingLeft: `${depth * 1.25 + 0.5}rem` }}
      >
        <div className="flex min-w-0 items-center gap-2">
          {hasChildren ? (
            <button
              type="button"
              className="rounded border border-[var(--color-border)] px-1.5 text-xs"
              aria-expanded={open}
              aria-label={open ? 'Collapse' : 'Expand'}
              onClick={() => setOpen((v) => !v)}
            >
              {open ? '−' : '+'}
            </button>
          ) : (
            <span className="inline-block w-5" aria-hidden />
          )}
          <div className="min-w-0">
            <p className="truncate font-medium">{node.name}</p>
            <p className="truncate text-xs text-[var(--color-muted)]">{node.slug}</p>
          </div>
          <StatusBadge status={node.status} />
        </div>
        {canWrite ? (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => onEdit(node)}>
              Edit
            </Button>
            <Button variant="danger" onClick={() => onDelete(node)}>
              Delete
            </Button>
          </div>
        ) : null}
      </div>
      {hasChildren && open ? (
        <ul>
          {node.children.map((child: TreeNode) => (
            <TreeBranch
              key={child.id}
              node={child}
              depth={depth + 1}
              canWrite={canWrite}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function CategoryTree({
  categories,
  canWrite,
  onEdit,
  onDelete,
}: {
  categories: Category[];
  canWrite: boolean;
  onEdit: (category: Category) => void;
  onDelete: (category: Category) => void;
}) {
  const roots = useMemo(() => buildTree(categories), [categories]);

  if (roots.length === 0) {
    return null;
  }

  return (
    <ul className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] py-2">
      {roots.map((node) => (
        <TreeBranch
          key={node.id}
          node={node}
          depth={0}
          canWrite={canWrite}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </ul>
  );
}
