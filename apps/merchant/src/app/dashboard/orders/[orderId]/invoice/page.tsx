'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { OrderDetail, PublicStore, StoreSettings } from '@ecomesta/types';
import { InvoiceToolbar } from '@ecomesta/ui';
import { StoreScoped } from '@/components/catalog/store-scoped';
import { OrderInvoice, type InvoiceStore } from '@/components/orders/order-invoice';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { ApiError, api } from '@/lib/api-client';
import { humanApiError } from '@/lib/catalog-utils';
import { useStoreContext } from '@/lib/store-context';

export default function OrderInvoicePage() {
  const params = useParams<{ orderId: string }>();
  const orderId = params?.orderId;
  const { selectedStoreId, selectedStore } = useStoreContext();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [store, setStore] = useState<InvoiceStore | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!selectedStoreId || !orderId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [orderRes, settingsRes] = await Promise.all([
        api.get<{ success: true; data: OrderDetail }>(`/stores/${selectedStoreId}/orders/${orderId}`),
        api.get<{ success: true; data: StoreSettings }>(`/stores/${selectedStoreId}/settings`),
      ]);
      const settings = settingsRes.data;
      // The logo lives in the published theme; the public store already resolves it.
      const logoUrl = await api
        .get<{ success: true; data: PublicStore }>(`/public/stores/${settings.slug}`, { token: null })
        .then((res) => res.data.logoUrl)
        .catch(() => null);
      setOrder(orderRes.data);
      setStore({
        name: settings.businessName || settings.name,
        logoUrl,
        email: settings.email,
        phone: settings.phone,
        address: settings.address,
      });
    } catch (err) {
      setOrder(null);
      setError(
        err instanceof ApiError && err.status === 404
          ? 'Order not found in this store.'
          : humanApiError(err, 'Failed to load the invoice'),
      );
    } finally {
      setLoading(false);
    }
  }, [selectedStoreId, orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <StoreScoped>
      <div className="mx-auto max-w-5xl">
        <InvoiceToolbar>
          <Link href={`/dashboard/orders/${orderId}`} className="text-sm text-[var(--color-accent)] hover:underline">
            ← Back to order
          </Link>
        </InvoiceToolbar>
        {loading ? <LoadingState label="Loading invoice…" /> : null}
        {!loading && error ? <ErrorState message={error} onRetry={() => void load()} /> : null}
        {!loading && !error && order && store ? (
          <OrderInvoice order={order} store={{ ...store, name: store.name || selectedStore?.name || 'Store' }} />
        ) : null}
      </div>
    </StoreScoped>
  );
}
