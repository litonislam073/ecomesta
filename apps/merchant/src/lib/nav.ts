export type NavItem = {
  href: string;
  label: string;
  ready?: boolean;
};

export type NavSection = {
  title: string;
  items: NavItem[];
};

export const DASHBOARD_NAV: NavSection[] = [
  {
    title: 'Overview',
    items: [{ href: '/dashboard', label: 'Dashboard', ready: true }],
  },
  {
    title: 'Catalog',
    items: [
      { href: '/dashboard/products', label: 'Products', ready: true },
      { href: '/dashboard/categories', label: 'Categories', ready: true },
      { href: '/dashboard/inventory', label: 'Inventory', ready: true },
    ],
  },
  {
    title: 'Sales',
    items: [
      { href: '/dashboard/orders', label: 'Orders', ready: true },
      { href: '/dashboard/customers', label: 'Customers', ready: true },
    ],
  },
  {
    title: 'Payments',
    items: [{ href: '/dashboard/payments', label: 'Payments' }],
  },
  {
    title: 'Marketing',
    items: [{ href: '/dashboard/coupons', label: 'Coupons' }],
  },
  {
    title: 'Store',
    items: [
      { href: '/dashboard/themes', label: 'Themes' },
      { href: '/dashboard/domains', label: 'Domains' },
      { href: '/dashboard/settings', label: 'Settings' },
      { href: '/dashboard/shipping', label: 'Shipping' },
      { href: '/dashboard/stores', label: 'Stores', ready: true },
    ],
  },
];
