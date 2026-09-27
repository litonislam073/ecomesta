export interface DemoCategoryDefinition {
  key: string;
  name: string;
  slug: string;
  description: string;
}

export interface DemoVariantDefinition {
  name: string;
  sku: string;
  price: string;
  quantity: number;
}

export interface DemoProductDefinition {
  name: string;
  slug: string;
  sku: string;
  shortDescription: string;
  description: string;
  categoryKey: string;
  /** BDT, two decimals. For variant products this is the lowest variant price. */
  basePrice: string;
  compareAtPrice?: string;
  /** Opening stock for products without variants. */
  quantity?: number;
  variants?: DemoVariantDefinition[];
}

/**
 * Sample images ship with the storefront app (apps/web/public/demo-catalog),
 * named after each product's base slug, so no external host is involved.
 */
export function demoProductImageUrl(definition: DemoProductDefinition): string {
  return `/demo-catalog/${definition.slug}.jpg`;
}

export const DEMO_CATEGORIES: DemoCategoryDefinition[] = [
  {
    key: 'electronics',
    name: 'Electronics',
    slug: 'electronics',
    description: 'Sample gadgets and accessories.',
  },
  {
    key: 'fashion',
    name: 'Fashion',
    slug: 'fashion',
    description: 'Sample clothing, footwear and bags.',
  },
  {
    key: 'home-living',
    name: 'Home & Living',
    slug: 'home-living',
    description: 'Sample home and desk essentials.',
  },
  {
    key: 'beauty',
    name: 'Beauty',
    slug: 'beauty',
    description: 'Sample personal care products.',
  },
  {
    key: 'grocery',
    name: 'Grocery',
    slug: 'grocery',
    description: 'Sample pantry items.',
  },
];

export const DEMO_PRODUCTS: DemoProductDefinition[] = [
  {
    name: 'Wireless Headphones',
    slug: 'wireless-headphones',
    sku: 'SAMPLE-HEADPHONES',
    shortDescription: 'Over-ear Bluetooth headphones with 30-hour battery.',
    description:
      'Comfortable over-ear wireless headphones with soft cushions, Bluetooth 5.3 and up to 30 hours of playback on a single charge.',
    categoryKey: 'electronics',
    basePrice: '2490.00',
    compareAtPrice: '2990.00',
    quantity: 25,
  },
  {
    name: 'Smart Watch',
    slug: 'smart-watch',
    sku: 'SAMPLE-SMARTWATCH',
    shortDescription: 'Fitness tracking, heart-rate and notifications.',
    description:
      'A lightweight smart watch with step counting, heart-rate monitoring, sleep tracking and phone notifications. Water resistant for everyday use.',
    categoryKey: 'electronics',
    basePrice: '3990.00',
    quantity: 15,
  },
  {
    name: 'Cotton T-Shirt',
    slug: 'cotton-t-shirt',
    sku: 'SAMPLE-TSHIRT',
    shortDescription: 'Breathable 100% cotton crew-neck tee.',
    description:
      'Soft, breathable crew-neck t-shirt made from 100% combed cotton. Suitable for warm weather and everyday wear.',
    categoryKey: 'fashion',
    basePrice: '590.00',
    variants: [
      { name: 'Size S', sku: 'SAMPLE-TSHIRT-S', price: '590.00', quantity: 20 },
      { name: 'Size M', sku: 'SAMPLE-TSHIRT-M', price: '590.00', quantity: 30 },
      { name: 'Size L', sku: 'SAMPLE-TSHIRT-L', price: '590.00', quantity: 20 },
    ],
  },
  {
    name: 'Casual Sneakers',
    slug: 'casual-sneakers',
    sku: 'SAMPLE-SNEAKERS',
    shortDescription: 'Lightweight everyday sneakers.',
    description:
      'Lightweight casual sneakers with a cushioned sole and breathable upper, designed for all-day comfort.',
    categoryKey: 'fashion',
    basePrice: '2290.00',
    variants: [
      { name: 'Size 40', sku: 'SAMPLE-SNEAKERS-40', price: '2290.00', quantity: 10 },
      { name: 'Size 41', sku: 'SAMPLE-SNEAKERS-41', price: '2290.00', quantity: 12 },
      { name: 'Size 42', sku: 'SAMPLE-SNEAKERS-42', price: '2290.00', quantity: 8 },
    ],
  },
  {
    name: 'Premium Backpack',
    slug: 'premium-backpack',
    sku: 'SAMPLE-BACKPACK',
    shortDescription: 'Water-resistant backpack with laptop sleeve.',
    description:
      'A durable, water-resistant backpack with a padded 15.6-inch laptop sleeve, multiple compartments and comfortable shoulder straps.',
    categoryKey: 'fashion',
    basePrice: '1850.00',
    compareAtPrice: '2200.00',
    quantity: 18,
  },
  {
    name: 'Ceramic Coffee Mug',
    slug: 'ceramic-coffee-mug',
    sku: 'SAMPLE-MUG',
    shortDescription: '350 ml glazed ceramic mug.',
    description:
      'A sturdy 350 ml glazed ceramic mug for tea or coffee. Microwave and dishwasher safe.',
    categoryKey: 'home-living',
    basePrice: '350.00',
    quantity: 50,
  },
  {
    name: 'LED Desk Lamp',
    slug: 'led-desk-lamp',
    sku: 'SAMPLE-DESKLAMP',
    shortDescription: 'Adjustable LED lamp with three brightness levels.',
    description:
      'An energy-efficient LED desk lamp with an adjustable arm, three brightness levels and a USB power cable.',
    categoryKey: 'home-living',
    basePrice: '1290.00',
    quantity: 20,
  },
  {
    name: 'Skincare Gift Set',
    slug: 'skincare-gift-set',
    sku: 'SAMPLE-SKINCARE',
    shortDescription: 'Cleanser, toner and moisturiser set.',
    description:
      'A gift-ready skincare set with a gentle cleanser, hydrating toner and daily moisturiser, suitable for most skin types.',
    categoryKey: 'beauty',
    basePrice: '1650.00',
    quantity: 12,
  },
  {
    name: 'Pure Honey (500 g)',
    slug: 'pure-honey-500g',
    sku: 'SAMPLE-HONEY',
    shortDescription: 'Natural honey in a 500 g jar.',
    description:
      'Natural, unprocessed honey packed in a 500 g glass jar. Great with tea, breakfast or desserts.',
    categoryKey: 'grocery',
    basePrice: '650.00',
    quantity: 30,
  },
];
