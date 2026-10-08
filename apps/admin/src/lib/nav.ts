export type NavItem = {
  href: string;
  label: string;
};

export type NavSection = {
  title: string;
  items: NavItem[];
};

export const ADMIN_NAV: NavSection[] = [
  {
    title: 'Overview',
    items: [{ href: '/dashboard', label: 'Dashboard' }],
  },
  {
    title: 'Accounts',
    items: [
      { href: '/dashboard/users', label: 'Users' },
      { href: '/dashboard/tenants', label: 'Tenants' },
      { href: '/dashboard/stores', label: 'Stores' },
    ],
  },
  {
    title: 'Billing',
    items: [
      { href: '/dashboard/payments', label: 'Payments' },
      { href: '/dashboard/theme-purchases', label: 'Theme purchases' },
      { href: '/dashboard/plans', label: 'Plans' },
      { href: '/dashboard/subscriptions', label: 'Subscriptions' },
    ],
  },
  {
    title: 'Platform',
    items: [
      { href: '/dashboard/support-chats', label: 'Support chats' },
      { href: '/dashboard/email', label: 'Email' },
    ],
  },
  {
    title: 'Compliance',
    items: [{ href: '/dashboard/audit-logs', label: 'Audit Logs' }],
  },
];
