import { ApiError } from '@/lib/api-client';

/**
 * Emailed links carry the token in the URL fragment (`#token=…`), which the
 * browser never sends to a server. Read it once, then drop it from the address
 * bar and history so it cannot leak through screenshots or shared URLs.
 */
export function takeEmailLinkToken(): string | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const token = params.get('token');
  if (window.location.hash) {
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
  }
  return token && /^[A-Za-z0-9_-]{20,128}$/.test(token) ? token : null;
}

export type LinkProblem = 'invalid' | 'expired' | 'used';

/** Classifies a failed token check; null means an unexpected (server/network) failure. */
export function linkProblem(error: unknown): LinkProblem | null {
  if (!(error instanceof ApiError) || error.status >= 500 || error.status === 429) return null;
  if (error.code.endsWith('_EXPIRED')) return 'expired';
  if (error.code.endsWith('_USED')) return 'used';
  return error.status === 400 ? 'invalid' : null;
}
