'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { StoreTracking as StoreTrackingConfig } from '@ecomesta/types';
import { installTags, trackPageView, validTrackingId } from '@/lib/tracking';

/** Page views on every in-store navigation (the first one included). */
function PageViews() {
  const pathname = usePathname();
  const search = useSearchParams()?.toString() ?? '';
  const last = useRef<string | null>(null);
  useEffect(() => {
    const path = search ? `${pathname}?${search}` : pathname;
    if (last.current === path) return;
    last.current = path;
    trackPageView(path);
  }, [pathname, search]);
  return null;
}

/**
 * The merchant's Meta Pixel, Google Analytics 4 and Google Tag Manager, built
 * from their IDs with the vendors' standard loaders. Nothing loads for IDs
 * that are not set (or not well-formed).
 */
function ids(tracking: StoreTrackingConfig | null | undefined) {
  return {
    pixel: validTrackingId('metaPixelId', tracking?.metaPixelId),
    gtm: validTrackingId('gtmContainerId', tracking?.gtmContainerId),
    ga4: validTrackingId('ga4MeasurementId', tracking?.ga4MeasurementId),
  };
}

/**
 * Installs the tags during the first client render. Rendered before the page
 * and outside any Suspense boundary, so it runs before any page's own events
 * (a product view, a purchase) fire on hydration.
 */
export function StoreTagInstaller({ tracking }: { tracking: StoreTrackingConfig | null | undefined }) {
  useState(() => {
    const { pixel, gtm, ga4 } = ids(tracking);
    if (pixel || gtm || ga4) installTags({ pixel, gtm, ga4 });
    return null;
  });
  return null;
}

/** Page views on navigation, and GTM's no-JavaScript fallback. */
export function StoreTracking({ tracking }: { tracking: StoreTrackingConfig | null | undefined }) {
  const { pixel, gtm, ga4 } = ids(tracking);
  if (!pixel && !gtm && !ga4) return null;
  return (
    <>
      {gtm ? (
        <noscript>
          <iframe
            title="Google Tag Manager"
            src={`https://www.googletagmanager.com/ns.html?id=${gtm}`}
            height="0"
            width="0"
            style={{ display: 'none', visibility: 'hidden' }}
          />
        </noscript>
      ) : null}
      <PageViews />
    </>
  );
}
