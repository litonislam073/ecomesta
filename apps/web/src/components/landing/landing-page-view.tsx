'use client';

import { Suspense, useEffect, useRef, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import type { PublicStore } from '@ecomesta/types';
import type { LandingTemplateKey } from '@ecomesta/utils';
import { StoreTagInstaller, StoreTracking } from '@/components/storefront/store-tracking';
import type { PublicLandingPage } from '@/lib/landing';
import { storeLang } from '@/lib/store-seo';
import { trackViewItem } from '@/lib/tracking';
import { LandingProvider, useLanding } from './landing-context';
import { landingThemeStyle } from './landing-theme';
import { BeautyTemplate } from './templates/beauty';
import { CampaignTemplate } from './templates/campaign';
import { FashionTemplate } from './templates/fashion';
import { FoodTemplate } from './templates/food';
import { GadgetTemplate } from './templates/gadget';
import { HomeTemplate } from './templates/home';
import { KidsTemplate } from './templates/kids';
import { SingleProductTemplate } from './templates/single-product';
import { StoryTemplate } from './templates/story';
import { TrendTemplate } from './templates/trend';

/** Messages from the merchant's landing page editor (the parent window). */
export const LANDING_PREVIEW_MESSAGE = 'ecomesta-landing-preview';

const TEMPLATES: Record<LandingTemplateKey, () => JSX.Element> = {
  single_product: SingleProductTemplate,
  campaign: CampaignTemplate,
  fashion: FashionTemplate,
  food: FoodTemplate,
  story: StoryTemplate,
  gadget: GadgetTemplate,
  beauty: BeautyTemplate,
  kids: KidsTemplate,
  home: HomeTemplate,
  trend: TrendTemplate,
};

/** Inside the editor's preview frame: reload when the editor sends a new draft, and jump to a section. */
function PreviewBridge() {
  const router = useRouter();
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window.parent || event.data?.type !== LANDING_PREVIEW_MESSAGE) return;
      if (event.data.action === 'refresh') router.refresh();
      if (event.data.action === 'focus' && typeof event.data.section === 'string') {
        document.querySelector(`[data-section="${CSS.escape(event.data.section)}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    };
    window.addEventListener('message', onMessage);
    window.parent?.postMessage({ type: LANDING_PREVIEW_MESSAGE, action: 'ready' }, '*');
    return () => window.removeEventListener('message', onMessage);
  }, [router]);
  return null;
}

/** The shopper looked at the page's main product (marketing tags, once). */
function ViewTracker() {
  const { products, preview, demo, currency } = useLanding();
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current || preview || demo) return;
    const product = products[0];
    if (!product) return;
    sent.current = true;
    trackViewItem({ id: product.id, name: product.name, price: product.price, quantity: 1 }, currency);
  }, [products, preview, demo, currency]);
  return null;
}

export function LandingPageView({ page, store }: { page: PublicLandingPage; store: PublicStore }) {
  const Template = TEMPLATES[page.template];
  return (
    <LandingProvider page={page} store={store}>
      {page.preview ? null : <StoreTagInstaller tracking={store.tracking} storeSlug={store.slug} />}
      <div lang={storeLang(store)} style={landingThemeStyle(page.template, page.content.colors) as CSSProperties} className="min-h-screen">
        <Template />
      </div>
      {page.preview ? (
        <PreviewBridge />
      ) : (
        <Suspense fallback={null}>
          <StoreTracking tracking={store.tracking} />
          <ViewTracker />
        </Suspense>
      )}
    </LandingProvider>
  );
}
