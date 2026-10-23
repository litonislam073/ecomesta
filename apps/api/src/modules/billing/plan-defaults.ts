import type { PlanLimits } from '@ecomesta/types';

export interface DefaultPlan {
  slug: string;
  name: string;
  /** BDT per month; 6-month and yearly prices are derived (10% / 25% off). */
  monthlyPrice: number;
  tagline: string;
  highlighted: boolean;
  sortOrder: number;
  features: string[];
  limits: PlanLimits;
}

/**
 * Ecomesta's plans. Keep in sync with the migrations that set the same values
 * on existing databases: `20261001090000_manual_billing_payments` and
 * `20261007120000_plan_storage_limits` (product and storage limits) and
 * `20261008090000_premium_themes` (premium themes on Business) and
 * `20261014090000_landing_pages` (landing pages on Growth and Business) and
 * `20261016090000_store_analytics` (full analytics on Growth and Business).
 */
export const DEFAULT_PLANS: readonly DefaultPlan[] = [
  {
    slug: 'starter',
    name: 'Starter',
    monthlyPrice: 99,
    tagline: 'For new online businesses',
    highlighted: false,
    sortOrder: 1,
    features: [
      'Online store on your own Ecomesta web address',
      'Up to 25 products with variants and categories',
      '1 GB storage',
      'Orders, customers and inventory in one dashboard',
      'Cash on Delivery checkout',
      'Default storefront theme',
      'Sales overview for the last 30 days',
    ],
    limits: {
      maxProducts: 25,
      storageMb: 1024,
      customDomain: false,
      onlinePayments: false,
      stripe: false,
      coupons: false,
      deliveryZones: false,
      allThemes: false,
      premiumThemes: false,
      marketingTracking: false,
      landingPages: false,
      maxLandingPages: 0,
      advancedAnalytics: false,
    },
  },
  {
    slug: 'growth',
    name: 'Growth',
    monthlyPrice: 299,
    tagline: 'For growing online businesses',
    highlighted: true,
    sortOrder: 2,
    features: [
      'Everything in Starter',
      'Up to 100 products',
      '3 GB storage',
      'Connect your own domain',
      'Online payments with SSLCommerz (bKash, Nagad, cards)',
      'Discount coupons and Bangladesh delivery zones',
      'All included themes (Default and Minimal)',
      'Facebook Pixel, Google Analytics & Tag Manager',
      'Up to 5 landing pages with their own order form',
      'Full sales and visitor analytics',
    ],
    limits: {
      maxProducts: 100,
      storageMb: 3072,
      customDomain: true,
      onlinePayments: true,
      stripe: false,
      coupons: true,
      deliveryZones: true,
      allThemes: true,
      premiumThemes: false,
      marketingTracking: true,
      landingPages: true,
      maxLandingPages: 5,
      advancedAnalytics: true,
    },
  },
  {
    slug: 'business',
    name: 'Business',
    monthlyPrice: 699,
    tagline: 'For established online businesses',
    highlighted: false,
    sortOrder: 3,
    features: [
      'Everything in Growth',
      'Unlimited products',
      '5 GB storage',
      'Stripe for international card payments',
      'Priority support',
      'Premium themes included',
      'Unlimited landing pages',
    ],
    limits: {
      maxProducts: null,
      storageMb: 5120,
      customDomain: true,
      onlinePayments: true,
      stripe: true,
      coupons: true,
      deliveryZones: true,
      allThemes: true,
      premiumThemes: true,
      marketingTracking: true,
      landingPages: true,
      maxLandingPages: null,
      advancedAnalytics: true,
    },
  },
];
