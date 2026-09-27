'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import type {
  BdLocationItem,
  OffsetPageMeta,
  ShippingMethod,
  ShippingMethodType,
  ShippingZone,
} from '@ecomesta/types';
import { Button } from '@ecomesta/ui';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Input } from '@/components/ui/input';
import { LoadingState } from '@/components/ui/loading-state';
import { Pagination } from '@/components/ui/pagination';
import { Select } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { ApiError, api } from '@/lib/api-client';
import { useCanManageStore } from '@/lib/permissions';
import { useStoreContext } from '@/lib/store-context';

const TYPES: ShippingMethodType[] = ['FLAT', 'FREE', 'WEIGHT_BASED', 'EXTERNAL'];

type MethodForm = {
  name: string;
  type: ShippingMethodType;
  price: string;
  active: boolean;
  zoneId: string;
  freeShippingThreshold: string;
  codAllowed: boolean;
  estimatedDelivery: string;
  sortOrder: string;
};

type ZoneForm = {
  name: string;
  priority: string;
  active: boolean;
  divisionId: string;
  districtId: string;
  upazilaId: string;
  locations: { divisionId?: string; districtId?: string; upazilaId?: string; label: string }[];
};

const emptyMethodForm = (): MethodForm => ({
  name: '',
  type: 'FLAT',
  price: '60.00',
  active: true,
  zoneId: '',
  freeShippingThreshold: '',
  codAllowed: true,
  estimatedDelivery: '',
  sortOrder: '0',
});

const emptyZoneForm = (): ZoneForm => ({
  name: '',
  priority: '10',
  active: true,
  divisionId: '',
  districtId: '',
  upazilaId: '',
  locations: [],
});

export default function ShippingPage() {
  const { selectedStoreId } = useStoreContext();
  const canWrite = useCanManageStore();
  const { pushToast } = useToast();

  const [tab, setTab] = useState<'zones' | 'methods'>('zones');
  const [zones, setZones] = useState<ShippingZone[]>([]);
  const [items, setItems] = useState<ShippingMethod[]>([]);
  const [meta, setMeta] = useState<OffsetPageMeta | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showMethodForm, setShowMethodForm] = useState(false);
  const [editingMethod, setEditingMethod] = useState<ShippingMethod | null>(null);
  const [deleteMethodId, setDeleteMethodId] = useState<string | null>(null);
  const [methodForm, setMethodForm] = useState<MethodForm>(emptyMethodForm);

  const [showZoneForm, setShowZoneForm] = useState(false);
  const [editingZone, setEditingZone] = useState<ShippingZone | null>(null);
  const [deleteZoneId, setDeleteZoneId] = useState<string | null>(null);
  const [zoneForm, setZoneForm] = useState<ZoneForm>(emptyZoneForm);

  const [divisions, setDivisions] = useState<BdLocationItem[]>([]);
  const [districts, setDistricts] = useState<BdLocationItem[]>([]);
  const [upazilas, setUpazilas] = useState<BdLocationItem[]>([]);
  const [busy, setBusy] = useState(false);

  const loadZones = useCallback(async () => {
    if (!selectedStoreId) return;
    const result = await api.get<{
      success: true;
      data: { items: ShippingZone[]; meta: OffsetPageMeta };
    }>(`/stores/${selectedStoreId}/shipping-zones?limit=100`);
    setZones(result.data.items);
  }, [selectedStoreId]);

  const loadMethods = useCallback(async () => {
    if (!selectedStoreId) return;
    const params = new URLSearchParams({
      page: String(page),
      limit: '20',
      sortBy: 'sortOrder',
      sortOrder: 'asc',
    });
    const result = await api.get<{
      success: true;
      data: { items: ShippingMethod[]; meta: OffsetPageMeta };
    }>(`/stores/${selectedStoreId}/shipping-methods?${params.toString()}`);
    setItems(result.data.items);
    setMeta(result.data.meta);
  }, [selectedStoreId, page]);

  const load = useCallback(async () => {
    if (!selectedStoreId) {
      setItems([]);
      setZones([]);
      setMeta(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await Promise.all([loadZones(), loadMethods()]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load shipping');
    } finally {
      setLoading(false);
    }
  }, [selectedStoreId, loadZones, loadMethods]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!selectedStoreId || !showZoneForm) return;
    let cancelled = false;
    (async () => {
      try {
        const result = await api.get<{ success: true; data: BdLocationItem[] }>(
          `/stores/${selectedStoreId}/locations/divisions`,
        );
        if (!cancelled) setDivisions(result.data);
      } catch {
        if (!cancelled) setDivisions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedStoreId, showZoneForm]);

  useEffect(() => {
    if (!selectedStoreId || !zoneForm.divisionId) {
      setDistricts([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const result = await api.get<{ success: true; data: BdLocationItem[] }>(
          `/stores/${selectedStoreId}/locations/districts?divisionId=${zoneForm.divisionId}`,
        );
        if (!cancelled) setDistricts(result.data);
      } catch {
        if (!cancelled) setDistricts([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedStoreId, zoneForm.divisionId]);

  useEffect(() => {
    if (!selectedStoreId || !zoneForm.districtId) {
      setUpazilas([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const result = await api.get<{ success: true; data: BdLocationItem[] }>(
          `/stores/${selectedStoreId}/locations/upazilas?districtId=${zoneForm.districtId}`,
        );
        if (!cancelled) setUpazilas(result.data);
      } catch {
        if (!cancelled) setUpazilas([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedStoreId, zoneForm.districtId]);

  function openCreateMethod() {
    setEditingMethod(null);
    setMethodForm(emptyMethodForm());
    setShowMethodForm(true);
  }

  function openEditMethod(method: ShippingMethod) {
    setEditingMethod(method);
    setMethodForm({
      name: method.name,
      type: method.type,
      price: method.price,
      active: method.active,
      zoneId: method.zoneId ?? '',
      freeShippingThreshold: method.freeShippingThreshold ?? '',
      codAllowed: method.codAllowed,
      estimatedDelivery: method.estimatedDelivery ?? '',
      sortOrder: String(method.sortOrder ?? 0),
    });
    setShowMethodForm(true);
  }

  function openCreateZone() {
    setEditingZone(null);
    setZoneForm(emptyZoneForm());
    setShowZoneForm(true);
  }

  function openEditZone(zone: ShippingZone) {
    setEditingZone(zone);
    setZoneForm({
      name: zone.name,
      priority: String(zone.priority),
      active: zone.active,
      divisionId: '',
      districtId: '',
      upazilaId: '',
      locations: zone.locations.map((loc) => ({
        divisionId: loc.divisionId ?? undefined,
        districtId: loc.districtId ?? undefined,
        upazilaId: loc.upazilaId ?? undefined,
        label: [loc.division?.name, loc.district?.name, loc.upazila?.name]
          .filter(Boolean)
          .join(' / '),
      })),
    });
    setShowZoneForm(true);
  }

  function addZoneLocation() {
    const { divisionId, districtId, upazilaId } = zoneForm;
    if (!divisionId && !districtId && !upazilaId) {
      pushToast('Select a division, district, or upazila', 'error');
      return;
    }
    const divName = divisions.find((d) => d.id === divisionId)?.name;
    const distName = districts.find((d) => d.id === districtId)?.name;
    const upName = upazilas.find((u) => u.id === upazilaId)?.name;
    const label = [divName, distName, upName].filter(Boolean).join(' / ');
    setZoneForm((f) => ({
      ...f,
      locations: [
        ...f.locations,
        {
          divisionId: upazilaId || districtId ? undefined : divisionId || undefined,
          districtId: upazilaId ? undefined : districtId || undefined,
          upazilaId: upazilaId || undefined,
          label,
        },
      ],
      districtId: '',
      upazilaId: '',
    }));
  }

  async function onSaveZone(event: FormEvent) {
    event.preventDefault();
    if (!selectedStoreId || !canWrite) return;
    if (zoneForm.locations.length === 0) {
      pushToast('Add at least one location mapping', 'error');
      return;
    }
    setBusy(true);
    try {
      const body = {
        name: zoneForm.name.trim(),
        priority: Number(zoneForm.priority) || 0,
        active: zoneForm.active,
        locations: zoneForm.locations.map(({ divisionId, districtId, upazilaId }) => ({
          divisionId,
          districtId,
          upazilaId,
        })),
      };
      if (editingZone) {
        await api.patch(
          `/stores/${selectedStoreId}/shipping-zones/${editingZone.id}`,
          body,
        );
        pushToast('Zone updated', 'success');
      } else {
        await api.post(`/stores/${selectedStoreId}/shipping-zones`, body);
        pushToast('Zone created', 'success');
      }
      setShowZoneForm(false);
      setEditingZone(null);
      await load();
    } catch (err) {
      pushToast(err instanceof ApiError ? err.message : 'Save failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function onSaveMethod(event: FormEvent) {
    event.preventDefault();
    if (!selectedStoreId || !canWrite) return;
    setBusy(true);
    try {
      const body = {
        name: methodForm.name.trim(),
        type: methodForm.type,
        price: methodForm.type === 'FREE' ? '0' : methodForm.price,
        active: methodForm.active,
        provider: 'MANUAL' as const,
        zoneId: methodForm.zoneId || null,
        freeShippingThreshold: methodForm.freeShippingThreshold.trim() || null,
        codAllowed: methodForm.codAllowed,
        estimatedDelivery: methodForm.estimatedDelivery.trim() || null,
        sortOrder: Number(methodForm.sortOrder) || 0,
      };
      if (editingMethod) {
        await api.patch(
          `/stores/${selectedStoreId}/shipping-methods/${editingMethod.id}`,
          body,
        );
        pushToast('Shipping method updated', 'success');
      } else {
        await api.post(`/stores/${selectedStoreId}/shipping-methods`, body);
        pushToast('Shipping method created', 'success');
      }
      setShowMethodForm(false);
      setEditingMethod(null);
      await load();
    } catch (err) {
      pushToast(err instanceof ApiError ? err.message : 'Save failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function onDeleteMethod() {
    if (!selectedStoreId || !deleteMethodId || !canWrite) return;
    setBusy(true);
    try {
      await api.delete(
        `/stores/${selectedStoreId}/shipping-methods/${deleteMethodId}`,
      );
      pushToast('Shipping method deleted', 'success');
      setDeleteMethodId(null);
      await load();
    } catch (err) {
      pushToast(err instanceof ApiError ? err.message : 'Delete failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function onDeleteZone() {
    if (!selectedStoreId || !deleteZoneId || !canWrite) return;
    setBusy(true);
    try {
      await api.delete(`/stores/${selectedStoreId}/shipping-zones/${deleteZoneId}`);
      pushToast('Zone deleted', 'success');
      setDeleteZoneId(null);
      await load();
    } catch (err) {
      pushToast(err instanceof ApiError ? err.message : 'Delete failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  if (!selectedStoreId) {
    return (
      <EmptyState
        title="Select a store"
        description="Choose a store to manage shipping zones and methods."
      />
    );
  }

  const zoneName = (zoneId: string | null) =>
    zoneId ? zones.find((z) => z.id === zoneId)?.name ?? 'Unknown zone' : 'Store-wide';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Shipping</h1>
          <p className="text-sm text-[var(--color-muted)]">
            Delivery zones and charges (e.g. Dhaka City ৳60 free≥2000; Outside Dhaka ৳120 free≥3000).
          </p>
        </div>
        {canWrite ? (
          <div className="flex gap-2">
            {tab === 'zones' ? (
              <Button type="button" onClick={openCreateZone}>
                Add zone
              </Button>
            ) : (
              <Button type="button" onClick={openCreateMethod}>
                Add method
              </Button>
            )}
          </div>
        ) : null}
      </div>

      <div className="flex gap-2 border-b border-[var(--color-border)] pb-2">
        <button
          type="button"
          className={`rounded px-3 py-1.5 text-sm ${tab === 'zones' ? 'bg-[var(--color-accent)] text-white' : 'text-[var(--color-muted)]'}`}
          onClick={() => setTab('zones')}
        >
          Zones
        </button>
        <button
          type="button"
          className={`rounded px-3 py-1.5 text-sm ${tab === 'methods' ? 'bg-[var(--color-accent)] text-white' : 'text-[var(--color-muted)]'}`}
          onClick={() => setTab('methods')}
        >
          Methods
        </button>
      </div>

      {!canWrite ? (
        <p className="text-sm text-[var(--color-muted)]">
          Staff can view shipping configuration; managers and owners can edit.
        </p>
      ) : null}

      {tab === 'zones' && showZoneForm && canWrite ? (
        <form
          onSubmit={onSaveZone}
          className="space-y-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
        >
          <h2 className="font-semibold">
            {editingZone ? 'Edit zone' : 'New shipping zone'}
          </h2>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="space-y-1 text-sm">
              <span>Name</span>
              <Input
                value={zoneForm.name}
                onChange={(e) => setZoneForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Dhaka City"
                required
              />
            </label>
            <label className="space-y-1 text-sm">
              <span>Priority (higher wins)</span>
              <Input
                value={zoneForm.priority}
                onChange={(e) =>
                  setZoneForm((f) => ({ ...f, priority: e.target.value }))
                }
              />
            </label>
            <label className="flex items-center gap-2 text-sm md:mt-6">
              <input
                type="checkbox"
                checked={zoneForm.active}
                onChange={(e) =>
                  setZoneForm((f) => ({ ...f, active: e.target.checked }))
                }
              />
              Active
            </label>
          </div>

          <div className="space-y-2 rounded border border-dashed border-[var(--color-border)] p-3">
            <p className="text-sm font-medium">Location mappings</p>
            <div className="grid gap-2 md:grid-cols-4">
              <Select
                value={zoneForm.divisionId}
                onChange={(e) =>
                  setZoneForm((f) => ({
                    ...f,
                    divisionId: e.target.value,
                    districtId: '',
                    upazilaId: '',
                  }))
                }
              >
                <option value="">Division…</option>
                {divisions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
              <Select
                value={zoneForm.districtId}
                onChange={(e) =>
                  setZoneForm((f) => ({
                    ...f,
                    districtId: e.target.value,
                    upazilaId: '',
                  }))
                }
                disabled={!zoneForm.divisionId}
              >
                <option value="">District (optional)…</option>
                {districts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
              <Select
                value={zoneForm.upazilaId}
                onChange={(e) =>
                  setZoneForm((f) => ({ ...f, upazilaId: e.target.value }))
                }
                disabled={!zoneForm.districtId}
              >
                <option value="">Upazila (optional)…</option>
                {upazilas.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </Select>
              <Button type="button" variant="secondary" onClick={addZoneLocation}>
                Add location
              </Button>
            </div>
            {zoneForm.locations.length === 0 ? (
              <p className="text-xs text-[var(--color-muted)]">
                No locations yet. Example: Dhaka district, or whole Outside-Dhaka via other districts.
              </p>
            ) : (
              <ul className="space-y-1 text-sm">
                {zoneForm.locations.map((loc, idx) => (
                  <li key={`${loc.label}-${idx}`} className="flex justify-between gap-2">
                    <span>{loc.label}</span>
                    <button
                      type="button"
                      className="text-red-700 hover:underline"
                      onClick={() =>
                        setZoneForm((f) => ({
                          ...f,
                          locations: f.locations.filter((_, i) => i !== idx),
                        }))
                      }
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={busy}>
              {busy ? 'Saving…' : 'Save zone'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowZoneForm(false);
                setEditingZone(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : null}

      {tab === 'methods' && showMethodForm && canWrite ? (
        <form
          onSubmit={onSaveMethod}
          className="space-y-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
        >
          <h2 className="font-semibold">
            {editingMethod ? 'Edit shipping method' : 'New shipping method'}
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span>Name</span>
              <Input
                value={methodForm.name}
                onChange={(e) =>
                  setMethodForm((f) => ({ ...f, name: e.target.value }))
                }
                required
              />
            </label>
            <label className="space-y-1 text-sm">
              <span>Type</span>
              <Select
                value={methodForm.type}
                onChange={(e) =>
                  setMethodForm((f) => ({
                    ...f,
                    type: e.target.value as ShippingMethodType,
                    price: e.target.value === 'FREE' ? '0.00' : f.price,
                  }))
                }
              >
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </label>
            <label className="space-y-1 text-sm">
              <span>Charge</span>
              <Input
                value={methodForm.price}
                onChange={(e) =>
                  setMethodForm((f) => ({ ...f, price: e.target.value }))
                }
                disabled={methodForm.type === 'FREE'}
                required={methodForm.type !== 'FREE'}
              />
            </label>
            <label className="space-y-1 text-sm">
              <span>Free shipping threshold</span>
              <Input
                value={methodForm.freeShippingThreshold}
                onChange={(e) =>
                  setMethodForm((f) => ({
                    ...f,
                    freeShippingThreshold: e.target.value,
                  }))
                }
                placeholder="2000.00"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span>Zone</span>
              <Select
                value={methodForm.zoneId}
                onChange={(e) =>
                  setMethodForm((f) => ({ ...f, zoneId: e.target.value }))
                }
              >
                <option value="">Store-wide (legacy)</option>
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name}
                  </option>
                ))}
              </Select>
            </label>
            <label className="space-y-1 text-sm">
              <span>Estimated delivery</span>
              <Input
                value={methodForm.estimatedDelivery}
                onChange={(e) =>
                  setMethodForm((f) => ({
                    ...f,
                    estimatedDelivery: e.target.value,
                  }))
                }
                placeholder="1–2 days"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span>Sort order</span>
              <Input
                value={methodForm.sortOrder}
                onChange={(e) =>
                  setMethodForm((f) => ({ ...f, sortOrder: e.target.value }))
                }
              />
            </label>
            <label className="flex items-center gap-2 text-sm md:mt-6">
              <input
                type="checkbox"
                checked={methodForm.codAllowed}
                onChange={(e) =>
                  setMethodForm((f) => ({ ...f, codAllowed: e.target.checked }))
                }
              />
              COD allowed
            </label>
            <label className="flex items-center gap-2 text-sm md:mt-6">
              <input
                type="checkbox"
                checked={methodForm.active}
                onChange={(e) =>
                  setMethodForm((f) => ({ ...f, active: e.target.checked }))
                }
              />
              Active
            </label>
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={busy}>
              {busy ? 'Saving…' : 'Save'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowMethodForm(false);
                setEditingMethod(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : null}

      {loading ? <LoadingState label="Loading shipping…" /> : null}
      {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}

      {tab === 'zones' && !loading && !error ? (
        zones.length === 0 ? (
          <EmptyState
            title="No shipping zones"
            description="Create zones like Dhaka City and Outside Dhaka, then attach methods."
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-[var(--color-border)] bg-[#f3f7f5] text-[var(--color-muted)]">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Priority</th>
                  <th className="px-4 py-3 font-medium">Locations</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  {canWrite ? (
                    <th className="px-4 py-3 font-medium">Actions</th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {zones.map((zone) => (
                  <tr
                    key={zone.id}
                    className="border-b border-[var(--color-border)] last:border-b-0"
                  >
                    <td className="px-4 py-3 font-medium">{zone.name}</td>
                    <td className="px-4 py-3">{zone.priority}</td>
                    <td className="px-4 py-3">
                      {zone.locations
                        .map((l) =>
                          [l.division?.name, l.district?.name, l.upazila?.name]
                            .filter(Boolean)
                            .join(' / '),
                        )
                        .join('; ') || '—'}
                    </td>
                    <td className="px-4 py-3">
                      {zone.active ? 'Active' : 'Inactive'}
                    </td>
                    {canWrite ? (
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="text-[var(--color-accent)] hover:underline"
                            onClick={() => openEditZone(zone)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="text-red-700 hover:underline"
                            onClick={() => setDeleteZoneId(zone.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : null}

      {tab === 'methods' && !loading && !error ? (
        items.length === 0 ? (
          <EmptyState
            title="No shipping methods"
            description="Create methods bound to a zone or store-wide (legacy)."
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-[var(--color-border)] bg-[#f3f7f5] text-[var(--color-muted)]">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Zone</th>
                  <th className="px-4 py-3 font-medium">Charge</th>
                  <th className="px-4 py-3 font-medium">Free ≥</th>
                  <th className="px-4 py-3 font-medium">COD</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  {canWrite ? (
                    <th className="px-4 py-3 font-medium">Actions</th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-[var(--color-border)] last:border-b-0"
                  >
                    <td className="px-4 py-3 font-medium">{item.name}</td>
                    <td className="px-4 py-3">{zoneName(item.zoneId)}</td>
                    <td className="px-4 py-3">{item.price}</td>
                    <td className="px-4 py-3">
                      {item.freeShippingThreshold ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      {item.codAllowed ? 'Yes' : 'No'}
                    </td>
                    <td className="px-4 py-3">
                      {item.active ? 'Active' : 'Inactive'}
                    </td>
                    {canWrite ? (
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="text-[var(--color-accent)] hover:underline"
                            onClick={() => openEditMethod(item)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="text-red-700 hover:underline"
                            onClick={() => setDeleteMethodId(item.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : null}

      {tab === 'methods' && meta ? (
        <Pagination
          page={meta.page}
          totalPages={meta.totalPages}
          onPageChange={setPage}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(deleteMethodId)}
        title="Delete shipping method?"
        description="Customers will no longer see this method. Historical orders keep their shipping snapshot."
        confirmLabel="Delete"
        onConfirm={() => void onDeleteMethod()}
        onCancel={() => setDeleteMethodId(null)}
        busy={busy}
      />
      <ConfirmDialog
        open={Boolean(deleteZoneId)}
        title="Delete shipping zone?"
        description="Methods in this zone become store-wide. Historical orders keep their zone name snapshot."
        confirmLabel="Delete"
        onConfirm={() => void onDeleteZone()}
        onCancel={() => setDeleteZoneId(null)}
        busy={busy}
      />
    </div>
  );
}
