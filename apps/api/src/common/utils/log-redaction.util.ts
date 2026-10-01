/** Query parameters whose values are personal data typed by staff (names, phones, emails). */
const REDACTED_QUERY_PARAMS = ['search'];

/** `/admin/support-chats?search=0171…&page=2` → `/admin/support-chats?search=[Redacted]&page=2`. */
export function redactUrlQuery(url: string): string {
  const queryStart = url.indexOf('?');
  if (queryStart === -1) return url;
  const query = url
    .slice(queryStart + 1)
    .split('&')
    .map((pair) => {
      const name = decodeURIComponentSafe(pair.split('=')[0] ?? '');
      return REDACTED_QUERY_PARAMS.includes(name) ? `${pair.split('=')[0]}=[Redacted]` : pair;
    })
    .join('&');
  return `${url.slice(0, queryStart)}?${query}`;
}

function decodeURIComponentSafe(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** pino-http request serializer: hides search terms in the logged URL and query object. */
export function redactRequestForLog<T extends { url?: unknown; query?: unknown }>(req: T): T {
  if (typeof req.url === 'string') req.url = redactUrlQuery(req.url);
  if (req.query && typeof req.query === 'object') {
    const query = { ...(req.query as Record<string, unknown>) };
    for (const name of REDACTED_QUERY_PARAMS) if (name in query) query[name] = '[Redacted]';
    req.query = query;
  }
  return req;
}
