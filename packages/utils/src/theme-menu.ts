/**
 * The storefront's primary menu always starts with a Home link. Theme presets
 * and saved menus may leave it out, so it is added in front unless the menu
 * already links to the store's home page.
 */
export function withHomeMenuItem<T extends { label: string; href: string }>(items: readonly T[]): (T | { label: string; href: string })[] {
  if (items.some((item) => item.href.trim() === '/')) return [...items];
  return [{ label: 'Home', href: '/' }, ...items];
}
