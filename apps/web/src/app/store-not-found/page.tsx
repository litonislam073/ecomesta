import { notFound } from 'next/navigation';

/**
 * Target of the middleware rewrite for hostnames that map to no ACTIVE
 * storefront. Throwing here renders the sibling `not-found.tsx` with a real
 * 404 status instead of a 200 "soft" error page.
 */
export default function StoreNotFoundPage() {
  notFound();
}
