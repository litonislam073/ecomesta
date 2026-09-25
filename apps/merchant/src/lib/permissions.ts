'use client';

import { useMemo } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useStoreContext } from '@/lib/store-context';

/**
 * UX-only write gate for catalog/customer actions.
 * Backend AuthorizationService remains authoritative.
 */
export function useCanManageStore() {
  const { user } = useAuth();
  const { selectedStoreId, selectedStore } = useStoreContext();

  return useMemo(() => {
    if (!user || !selectedStoreId) {
      return false;
    }
    if (user.platformRole === 'SUPER_ADMIN') {
      return true;
    }
    const storeRole = user.memberships.stores.find(
      (m) => m.storeId === selectedStoreId && m.status === 'ACTIVE',
    )?.role;
    if (storeRole === 'STORE_MANAGER') {
      return true;
    }
    if (selectedStore) {
      return user.memberships.tenants.some(
        (t) =>
          t.tenantId === selectedStore.tenantId &&
          t.status === 'ACTIVE' &&
          (t.role === 'OWNER' || t.role === 'ADMIN'),
      );
    }
    return false;
  }, [user, selectedStoreId, selectedStore]);
}
