export type NavItem = {
  href: string;
  label: string;
  ready?: boolean;
  children?: NavItem[];
};

export type NavSection = {
  title: string;
  items: NavItem[];
};

export const SETTINGS_NAV: NavItem[] = [
  { href: '/dashboard/settings', label: 'Overview', ready: true },
  { href: '/dashboard/settings/general', label: 'General', ready: true },
  { href: '/dashboard/settings/store', label: 'Store details', ready: true },
  { href: '/dashboard/settings/checkout', label: 'Checkout', ready: true },
  { href: '/dashboard/settings/orders', label: 'Orders', ready: true },
  { href: '/dashboard/settings/customers', label: 'Customers', ready: true },
  { href: '/dashboard/settings/notifications', label: 'Notifications', ready: true },
  { href: '/dashboard/settings/payments', label: 'Payments', ready: true },
  { href: '/dashboard/settings/shipping', label: 'Shipping', ready: true },
  { href: '/dashboard/settings/domains', label: 'Domains', ready: true },
  { href: '/dashboard/settings/seo', label: 'SEO', ready: true },
  { href: '/dashboard/settings/danger-zone', label: 'Danger zone', ready: true },
];

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
    items: [{ href: '/dashboard/payments', label: 'Payments', ready: true }],
  },
  {
    title: 'Marketing',
    items: [{ href: '/dashboard/coupons', label: 'Coupons', ready: true }],
  },
  {
    title: 'Store',
    items: [
      { href: '/dashboard/theme', label: 'Theme', ready: true },
      { href: '/dashboard/gallery', label: 'Gallery', ready: true },
      { href: '/dashboard/domains', label: 'Domains', ready: true },
      { href: '/dashboard/shipping', label: 'Shipping', ready: true },
      { href: '/dashboard/stores', label: 'Stores', ready: true },
      {
        href: '/dashboard/settings',
        label: 'Settings',
        ready: true,
        children: SETTINGS_NAV.slice(1),
      },
    ],
  },
  {
    title: 'Account',
    items: [
      { href: '/dashboard/billing', label: 'Plan & billing', ready: true },
      { href: '/dashboard/support', label: 'Help & support', ready: true },
    ],
  },
];

export function isNavItemActive(pathname: string, href: string, exact = false): boolean {
  if (href === '/dashboard' || exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}
