'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { CustomerAddress, CustomerDetail, OrderListItem } from '@ecomesta/types';
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

const COUNTRY_RE = /^[A-Z]{2}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type ProfileErrors = Partial<Record<'firstName' | 'lastName' | 'email', string>>;
type AddressErrors = Partial<Record<'addressLine1' | 'city' | 'country', string>>;

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="text-xs text-[var(--color-danger)]">
      {message}
    </p>
  );
}

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
  const [addressToDelete, setAddressToDelete] = useState<CustomerAddress | null>(null);
  const [profileErrors, setProfileErrors] = useState<ProfileErrors>({});
  const [addressErrors, setAddressErrors] = useState<AddressErrors>({});
  const [orders, setOrders] = useState<OrderListItem[] | null>(null);
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

  // Recent orders for this customer (best effort: the profile works without it).
  useEffect(() => {
    if (!selectedStoreId || !customerId) return;
    let cancelled = false;
    api
      .get<{ success: true; data: { items: OrderListItem[] } }>(
        `/stores/${selectedStoreId}/orders?customerId=${encodeURIComponent(customerId)}&limit=10`,
      )
      .then((res) => {
        if (!cancelled) setOrders(res.data.items);
      })
      .catch(() => {
        if (!cancelled) setOrders([]);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedStoreId, customerId]);

  async function onSave(event: FormEvent) {
    event.preventDefault();
    if (!selectedStoreId) return;
    const errors: ProfileErrors = {};
    if (!form.firstName.trim()) errors.firstName = 'First name is required.';
    if (!form.lastName.trim()) errors.lastName = 'Last name is required.';
    if (form.email.trim() && !EMAIL_RE.test(form.email.trim())) {
      errors.email = 'Enter a valid email address.';
    }
    setProfileErrors(errors);
    if (Object.keys(errors).length > 0) return;
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
    const country = addressForm.country.trim().toUpperCase();
    const errors: AddressErrors = {};
    if (!addressForm.addressLine1.trim()) errors.addressLine1 = 'Address line 1 is required.';
    if (!addressForm.city.trim()) errors.city = 'City is required.';
    if (!COUNTRY_RE.test(country)) {
      errors.country = 'Use a two-letter country code, for example BD.';
    }
    setAddressErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setBusy(true);
    try {
      await api.post(`/stores/${selectedStoreId}/customers/${customerId}/addresses`, {
        type: addressForm.type,
        addressLine1: addressForm.addressLine1.trim(),
        addressLine2: addressForm.addressLine2.trim() || undefined,
        city: addressForm.city.trim(),
        state: addressForm.state.trim() || undefined,
        postalCode: addressForm.postalCode.trim() || undefined,
        country,
        phone: addressForm.phone.trim() || undefined,
      });
      setAddressErrors({});
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
      setAddressToDelete(null);
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
          <form className="grid gap-3" onSubmit={onSave} noValidate>
            <label className="space-y-1 text-sm">
              <span>First name</span>
              <Input
                aria-required="true"
                aria-invalid={Boolean(profileErrors.firstName)}
                aria-describedby={profileErrors.firstName ? 'profile-firstName-error' : undefined}
                value={form.firstName}
                onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
              />
              <FieldError id="profile-firstName-error" message={profileErrors.firstName} />
            </label>
            <label className="space-y-1 text-sm">
              <span>Last name</span>
              <Input
                aria-required="true"
                aria-invalid={Boolean(profileErrors.lastName)}
                aria-describedby={profileErrors.lastName ? 'profile-lastName-error' : undefined}
                value={form.lastName}
                onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
              />
              <FieldError id="profile-lastName-error" message={profileErrors.lastName} />
            </label>
            <label className="space-y-1 text-sm">
              <span>Email</span>
              <Input
                type="email"
                aria-invalid={Boolean(profileErrors.email)}
                aria-describedby={profileErrors.email ? 'profile-email-error' : undefined}
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
              <FieldError id="profile-email-error" message={profileErrors.email} />
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

        <Card title="Orders" description="Most recent orders placed by this customer.">
          {orders === null ? (
            <LoadingState label="Loading orders" />
          ) : orders.length === 0 ? (
            <EmptyState
              title="No orders yet"
              description="Orders this customer places will show up here."
            />
          ) : (
            <ul className="divide-y divide-[var(--color-border)] text-sm">
              {orders.map((order) => (
                <li key={order.id} className="flex items-center justify-between gap-3 py-2">
                  <Link
                    href={`/dashboard/orders/${order.id}`}
                    className="font-medium text-[var(--color-accent)] hover:underline"
                  >
                    {order.orderNumber}
                  </Link>
                  <span className="text-[var(--color-muted)]">
                    {new Date(order.createdAt).toLocaleDateString()}
                  </span>
                  <span>
                    {order.grandTotal} {order.currency}
                  </span>
                </li>
              ))}
            </ul>
          )}
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
                      onClick={() => setAddressToDelete(address)}
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
            noValidate
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
                aria-required="true"
                aria-invalid={Boolean(addressErrors.country)}
                aria-describedby={
                  addressErrors.country ? 'address-country-error' : 'address-country-hint'
                }
                maxLength={2}
                autoCapitalize="characters"
                placeholder="BD"
                value={addressForm.country}
                onChange={(e) =>
                  setAddressForm((f) => ({ ...f, country: e.target.value.toUpperCase() }))
                }
              />
              {addressErrors.country ? (
                <FieldError id="address-country-error" message={addressErrors.country} />
              ) : (
                <p id="address-country-hint" className="text-xs text-[var(--color-muted)]">
                  Two-letter code. Defaults to BD (Bangladesh).
                </p>
              )}
            </label>
            <label className="space-y-1 text-sm md:col-span-2">
              <span>Address line 1</span>
              <Input
                aria-required="true"
                aria-invalid={Boolean(addressErrors.addressLine1)}
                aria-describedby={
                  addressErrors.addressLine1 ? 'address-line1-error' : undefined
                }
                value={addressForm.addressLine1}
                onChange={(e) =>
                  setAddressForm((f) => ({ ...f, addressLine1: e.target.value }))
                }
              />
              <FieldError id="address-line1-error" message={addressErrors.addressLine1} />
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
                aria-required="true"
                aria-invalid={Boolean(addressErrors.city)}
                aria-describedby={addressErrors.city ? 'address-city-error' : undefined}
                value={addressForm.city}
                onChange={(e) =>
                  setAddressForm((f) => ({ ...f, city: e.target.value }))
                }
              />
              <FieldError id="address-city-error" message={addressErrors.city} />
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
        confirmLabel="Delete customer"
        danger
        busy={busy}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => void onDeleteCustomer()}
      />

      <ConfirmDialog
        open={Boolean(addressToDelete)}
        title="Delete this address?"
        description={
          addressToDelete
            ? `${addressToDelete.addressLine1}, ${addressToDelete.city} will be removed from this customer. Past orders keep their own copy of the address.`
            : ''
        }
        confirmLabel="Delete address"
        danger
        busy={busy}
        onCancel={() => setAddressToDelete(null)}
        onConfirm={() => {
          if (addressToDelete) void onDeleteAddress(addressToDelete.id);
        }}
      />
    </div>
  );
}
