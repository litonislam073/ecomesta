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
 * Ecomesta's plans. Keep in sync with the
 * `20261001090000_manual_billing_payments` migration, which sets the same
 * values on existing databases.
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
      'Up to 50 products with variants and categories',
      'Orders, customers and inventory in one dashboard',
      'Cash on Delivery checkout',
      'Default storefront theme',
    ],
    limits: {
      maxProducts: 50,
      customDomain: false,
      onlinePayments: false,
      stripe: false,
      coupons: false,
      deliveryZones: false,
      allThemes: false,
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
      'Up to 500 products',
      'Connect your own domain',
      'Online payments with SSLCommerz (bKash, Nagad, cards)',
      'Discount coupons and Bangladesh delivery zones',
      'All storefront themes',
    ],
    limits: {
      maxProducts: 500,
      customDomain: true,
      onlinePayments: true,
      stripe: false,
      coupons: true,
      deliveryZones: true,
      allThemes: true,
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
      'Stripe for international card payments',
      'Priority support',
    ],
    limits: {
      maxProducts: null,
      customDomain: true,
      onlinePayments: true,
      stripe: true,
      coupons: true,
      deliveryZones: true,
      allThemes: true,
    },
  },
];
