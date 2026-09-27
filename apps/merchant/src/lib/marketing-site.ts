/** Public origin of the Ecomesta marketing site (no trailing slash). */
export function marketingSiteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_WEB_URL?.trim();
  if (configured) {
    return configured.replace(/\/+$/, '');
  }
  const root = process.env.NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN?.trim()
    .toLowerCase()
    .replace(/^\.+|\.+$/g, '');
  // Never ship localhost links from a production build.
  if (process.env.NODE_ENV === 'production' && root) {
    return `https://${root}`;
  }
  return 'http://localhost:3000';
}
