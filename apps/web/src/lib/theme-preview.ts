/**
 * Theme editor preview: the merchant's editor opens the storefront with
 * `?theme_preview=<token>`; the middleware forwards a well-formed token as a
 * request header, and pages then render the editor's unsaved draft (the API
 * checks the token belongs to this store). Shared by the middleware, server
 * pages and the in-preview client bridge, so no server-only imports here.
 */
export const THEME_PREVIEW_QUERY = 'theme_preview';
export const THEME_PREVIEW_HEADER = 'x-ecomesta-theme-preview';

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32}$/;

export function readThemePreviewToken(value: string | null | undefined): string | null {
  return value && TOKEN_PATTERN.test(value) ? value : null;
}

/** `href` with the preview token kept, so browsing inside the preview stays in it. */
export function withThemePreview(href: string, token: string): string {
  const url = new URL(href, 'http://local');
  url.searchParams.set(THEME_PREVIEW_QUERY, token);
  return `${url.pathname}${url.search}${url.hash}`;
}
