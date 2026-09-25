'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { CustomerAddress, CustomerDetail } from '@ecomesta/types';
import { Button } from '@ecomesta/ui';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Input } from '@/components/ui/input';
import { LoadingState } from '@/components/ui/loading-state';
import { Select } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { ApiError, api } from '@/lib/api-client';
import { useStoreContext } from '@/lib/store-context';

export default function CustomerDetailPage() {
  const params = useParams<{ customerId: string }>();
  const router = useRouter();
  const customerId = params.customerId;
  const { selectedStoreId } = useStoreContext();
  const { pushToast } = useToast();

  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    notes: '',
  });
  const [addressForm, setAddressForm] = useState({
    type: 'SHIPPING',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'BD',
    phone: '',
  });

  const load = useCallback(async () => {
    if (!selectedStoreId || !customerId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await api.get<{ success: true; data: CustomerDetail }>(
        `/stores/${selectedStoreId}/customers/${customerId}`,
      );
      setCustomer(result.data);
      setForm({
        firstName: result.data.firstName ?? '',
        lastName: result.data.lastName ?? '',
        email: result.data.email ?? '',
        phone: result.data.phone ?? '',
        notes: result.data.notes ?? '',
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load customer');
    } finally {
      setLoading(false);
    }
  }, [selectedStoreId, customerId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSave(event: FormEvent) {
    event.preventDefault();
    if (!selectedStoreId) return;
    setBusy(true);
    try {
      await api.patch(`/stores/${selectedStoreId}/customers/${customerId}`, {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        notes: form.notes.trim() || null,
      });
      pushToast('Customer updated', 'success');
      await load();
    } catch (err) {
      pushToast(err instanceof ApiError ? err.message : 'Update failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function onAddAddress(event: FormEvent) {
    event.preventDefault();
    if (!selectedStoreId) return;
    setBusy(true);
    try {
      await api.post(`/stores/${selectedStoreId}/customers/${customerId}/addresses`, {
        type: addressForm.type,
        addressLine1: addressForm.addressLine1.trim(),
        addressLine2: addressForm.addressLine2.trim() || undefined,
        city: addressForm.city.trim(),
        state: addressForm.state.trim() || undefined,
        postalCode: addressForm.postalCode.trim() || undefined,
        country: addressForm.country.trim().toUpperCase(),
        phone: addressForm.phone.trim() || undefined,
      });
      pushToast('Address added', 'success');
      setAddressForm({
        type: 'SHIPPING',
        addressLine1: '',
        addressLine2: '',
        city: '',
        state: '',
        postalCode: '',
        country: 'BD',
        phone: '',
      });
      await load();
    } catch (err) {
      pushToast(err instanceof ApiError ? err.message : 'Address create failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function onDeleteAddress(addressId: string) {
    if (!selectedStoreId) return;
    setBusy(true);
    try {
      await api.delete(
        `/stores/${selectedStoreId}/customers/${customerId}/addresses/${addressId}`,
      );
      pushToast('Address deleted', 'success');
      await load();
    } catch (err) {
      pushToast(err instanceof ApiError ? err.message : 'Address delete failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function onDeleteCustomer() {
    if (!selectedStoreId) return;
    setBusy(true);
    try {
      await api.delete(`/stores/${selectedStoreId}/customers/${customerId}`);
      pushToast('Customer deleted', 'success');
      router.push('/dashboard/customers');
    } catch (err) {
      pushToast(err instanceof ApiError ? err.message : 'Delete failed', 'error');
      setConfirmDelete(false);
    } finally {
      setBusy(false);
    }
  }

  if (!selectedStoreId) {
    return (
      <EmptyState
        title="Select a store"
        description="Choose a store to view this customer."
      />
    );
  }

  if (loading) {
    return <LoadingState label="Loading customer" />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={() => void load()} />;
  }

  if (!customer) {
    return <EmptyState title="Customer not found" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/dashboard/customers"
            className="text-sm text-[var(--color-accent)] hover:underline"
          >
            ← Customers
          </Link>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl tracking-tight">
            {[customer.firstName, customer.lastName].filter(Boolean).join(' ')}
          </h1>
        </div>
        <Button variant="danger" onClick={() => setConfirmDelete(true)}>
          Delete customer
        </Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Profile">
          <form className="grid gap-3" onSubmit={onSave}>
            <label className="space-y-1 text-sm">
              <span>First name</span>
              <Input
                required
                value={form.firstName}
                onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
              />
            </label>
            <label className="space-y-1 text-sm">
              <span>Last name</span>
              <Input
                required
                value={form.lastName}
                onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
              />
            </label>
            <label className="space-y-1 text-sm">
              <span>Email</span>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </label>
            <label className="space-y-1 text-sm">
              <span>Phone</span>
              <Input
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </label>
            <label className="space-y-1 text-sm">
              <span>Notes</span>
              <Input
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </label>
            <Button type="submit" disabled={busy}>
              {busy ? 'Saving…' : 'Save changes'}
            </Button>
          </form>
        </Card>

        <Card title="Orders" description="Order history will appear after Phase 7.">
          <EmptyState
            title="No orders yet"
            description="Orders are not available in this phase."
          />
        </Card>
      </div>

      <Card title="Addresses">
        <div className="space-y-4">
          {customer.addresses.length === 0 ? (
            <p className="text-sm text-[var(--color-muted)]">No addresses yet.</p>
          ) : (
            <ul className="space-y-3">
              {customer.addresses.map((address: CustomerAddress) => (
                <li
                  key={address.id}
                  className="rounded-md border border-[var(--color-border)] p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <Badge>{address.type}</Badge>
                      <p className="mt-2 text-sm font-medium">
                        {address.addressLine1}
                        {address.addressLine2 ? `, ${address.addressLine2}` : ''}
                      </p>
                      <p className="text-sm text-[var(--color-muted)]">
                        {[address.city, address.state, address.postalCode, address.country]
                          .filter(Boolean)
                          .join(', ')}
                      </p>
                    </div>
                    <Button
                      variant="secondary"
                      onClick={() => void onDeleteAddress(address.id)}
                      disabled={busy}
                    >
                      Delete
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <form
            onSubmit={onAddAddress}
            className="grid gap-3 border-t border-[var(--color-border)] pt-4 md:grid-cols-2"
          >
            <label className="space-y-1 text-sm">
              <span>Type</span>
              <Select
                value={addressForm.type}
                onChange={(e) =>
                  setAddressForm((f) => ({ ...f, type: e.target.value }))
                }
              >
                <option value="SHIPPING">SHIPPING</option>
                <option value="BILLING">BILLING</option>
              </Select>
            </label>
            <label className="space-y-1 text-sm">
              <span>Country (ISO-2)</span>
              <Input
                required
                maxLength={2}
                value={addressForm.country}
                onChange={(e) =>
                  setAddressForm((f) => ({ ...f, country: e.target.value }))
                }
              />
            </label>
            <label className="space-y-1 text-sm md:col-span-2">
              <span>Address line 1</span>
              <Input
                required
                value={addressForm.addressLine1}
                onChange={(e) =>
                  setAddressForm((f) => ({ ...f, addressLine1: e.target.value }))
                }
              />
            </label>
            <label className="space-y-1 text-sm md:col-span-2">
              <span>Address line 2</span>
              <Input
                value={addressForm.addressLine2}
                onChange={(e) =>
                  setAddressForm((f) => ({ ...f, addressLine2: e.target.value }))
                }
              />
            </label>
            <label className="space-y-1 text-sm">
              <span>City</span>
              <Input
                required
                value={addressForm.city}
                onChange={(e) =>
                  setAddressForm((f) => ({ ...f, city: e.target.value }))
                }
              />
            </label>
            <label className="space-y-1 text-sm">
              <span>State</span>
              <Input
                value={addressForm.state}
                onChange={(e) =>
                  setAddressForm((f) => ({ ...f, state: e.target.value }))
                }
              />
            </label>
            <label className="space-y-1 text-sm">
              <span>Postal code</span>
              <Input
                value={addressForm.postalCode}
                onChange={(e) =>
                  setAddressForm((f) => ({ ...f, postalCode: e.target.value }))
                }
              />
            </label>
            <label className="space-y-1 text-sm">
              <span>Phone</span>
              <Input
                value={addressForm.phone}
                onChange={(e) =>
                  setAddressForm((f) => ({ ...f, phone: e.target.value }))
                }
              />
            </label>
            <div className="md:col-span-2">
              <Button type="submit" disabled={busy}>
                Add address
              </Button>
            </div>
          </form>
        </div>
      </Card>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this customer?"
        description="Addresses will be removed. Customers with order history cannot be deleted."
        confirmLabel="Delete"
        danger
        busy={busy}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => void onDeleteCustomer()}
      />
    </div>
  );
}
