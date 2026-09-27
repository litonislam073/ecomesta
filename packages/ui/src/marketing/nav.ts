export interface NavItem {
  href: string;
  label: string;
}

export const PRIMARY_NAV: NavItem[] = [
  { href: '/features', label: 'Features' },
  { href: '/payments', label: 'Payments' },
  { href: '/shipping', label: 'Shipping' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/solutions', label: 'Solutions' },
  { href: '/resources', label: 'Resources' },
];

export const FOOTER_NAV: { heading: string; items: NavItem[] }[] = [
  {
    heading: 'Product',
    items: [
      { href: '/features', label: 'All features' },
      { href: '/features/online-store', label: 'Online store' },
      { href: '/features/product-management', label: 'Product management' },
      { href: '/features/inventory-management', label: 'Inventory management' },
      { href: '/features/order-management', label: 'Order management' },
      { href: '/features/store-customization', label: 'Store customization' },
      { href: '/features/custom-domain', label: 'Custom domain' },
      { href: '/pricing', label: 'Pricing' },
    ],
  },
  {
    heading: 'Payments & shipping',
    items: [
      { href: '/payments', label: 'Payment options' },
      { href: '/payments/cash-on-delivery', label: 'Cash on Delivery' },
      { href: '/payments/sslcommerz', label: 'SSLCommerz' },
      { href: '/shipping', label: 'Shipping overview' },
      { href: '/shipping/bangladesh', label: 'Bangladesh delivery' },
      { href: '/shipping/zones', label: 'Shipping zones' },
    ],
  },
  {
    heading: 'Solutions',
    items: [
      { href: '/solutions/small-business', label: 'Small businesses' },
      { href: '/solutions/facebook-sellers', label: 'Facebook sellers' },
      { href: '/solutions/online-business', label: 'Online businesses' },
      { href: '/solutions/retailers', label: 'Retailers' },
    ],
  },
  {
    heading: 'Resources',
    items: [
      { href: '/resources', label: 'Resource center' },
      { href: '/blog', label: 'Blog' },
      { href: '/faq', label: 'FAQ' },
    ],
  },
  {
    heading: 'Company',
    items: [
      { href: '/about', label: 'About Ecomesta' },
      { href: '/contact', label: 'Contact' },
    ],
  },
];

/** Joins a marketing-site path onto its origin ('' keeps links relative). */
export function marketingHref(siteOrigin: string, path: string): string {
  return `${siteOrigin.replace(/\/+$/, '')}${path}`;
}
