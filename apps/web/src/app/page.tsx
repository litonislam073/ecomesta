import type { Metadata } from 'next';
import { PLATFORM_HOME_METADATA, PlatformHome } from '@/components/platform-home';
import {
  StorefrontHome,
  storefrontHomeMetadata,
} from '@/components/storefront-home';
import {
  readHostResolution,
  readStoreSlugFromSearch,
} from '@/lib/store-resolver';

function hasStorefrontContext(
  searchParams: Record<string, string | string[] | undefined>,
): boolean {
  // Platform marketing home must not depend on NEXT_PUBLIC_DEFAULT_STORE_SLUG.
  if (readHostResolution()) {
    return true;
  }
  return Boolean(readStoreSlugFromSearch(searchParams));
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<Metadata> {
  if (hasStorefrontContext(searchParams)) {
    return storefrontHomeMetadata(searchParams);
  }
  return PLATFORM_HOME_METADATA;
}

/**
 * `/` is the SaaS homepage unless a storefront context is present
 * (resolved custom/platform host, or local `?store=` preview).
 */
export default async function RootPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  if (hasStorefrontContext(searchParams)) {
    return <StorefrontHome searchParams={searchParams} />;
  }
  return <PlatformHome />;
}
