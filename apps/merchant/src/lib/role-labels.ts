const ROLE_LABELS: Record<string, string> = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  STAFF: 'Staff',
  STORE_MANAGER: 'Manager',
  STORE_STAFF: 'Staff',
  SUPER_ADMIN: 'Platform admin',
};

/** Merchant-facing name for an API role code (e.g. STORE_MANAGER -> Manager). */
export function roleLabel(role: string | null | undefined): string {
  if (!role) return '—';
  const known = ROLE_LABELS[role];
  if (known) return known;
  const words = role.toLowerCase().split('_').filter(Boolean).join(' ');
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : '—';
}
