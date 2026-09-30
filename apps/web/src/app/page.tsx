import type { Metadata } from 'next';
import { PLATFORM_HOME_METADATA, PlatformHome } from '@/components/platform-home';
import {
  StorefrontHome,
  storefrontHomeMetadata,
} from '@/components/storefront-home';
import { resolveStoreSlug } from '@/lib/store-resolver';

/**
 * A store serves `/` only when the middleware attached one: a resolved store
 * host, or a local/preview `?store=`. On the platform apex `?store=` is
 * ignored, so the marketing home never turns into a merchant storefront.
 */
async function hasStorefrontContext(): Promise<boolean> {
  return Boolean(await resolveStoreSlug());
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<Metadata> {
  if (await hasStorefrontContext()) {
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
  if (await hasStorefrontContext()) {
    return <StorefrontHome searchParams={searchParams} />;
  }
  return <PlatformHome />;
}
