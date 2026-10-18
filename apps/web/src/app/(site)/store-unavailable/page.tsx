import { STORE_UNAVAILABLE_METADATA, StoreUnavailable } from '@/components/storefront/store-unavailable';

export const metadata = STORE_UNAVAILABLE_METADATA;

/** Target of the middleware rewrite for hosts whose store is suspended. */
export default function StoreUnavailablePage() {
  return <StoreUnavailable />;
}
