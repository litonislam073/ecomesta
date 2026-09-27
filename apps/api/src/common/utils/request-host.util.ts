/**
 * Selects the effective request hostname for tenant/domain routing.
 *
 * When trustProxy is false (default / local): ignore X-Forwarded-Host and
 * use the Host header only — clients must not spoof a custom domain.
 *
 * When trustProxy is true (production behind nginx): prefer X-Forwarded-Host
 * when present. Nginx must overwrite that header from $host so the client
 * cannot inject it (see infrastructure/nginx/snippets/proxy.conf).
 */
export function selectRequestHost(input: {
  hostHeader: string | null | undefined;
  forwardedHostHeader: string | null | undefined;
  trustProxy: boolean;
}): string | null {
  const raw = input.trustProxy
    ? (input.forwardedHostHeader ?? input.hostHeader)
    : input.hostHeader;
  return normalizeHostHeader(raw);
}

export function normalizeHostHeader(
  header: string | null | undefined,
): string | null {
  if (!header) {
    return null;
  }
  const first = header.split(',')[0]?.trim().toLowerCase() ?? '';
  if (!first) {
    return null;
  }
  if (first.startsWith('[')) {
    const close = first.indexOf(']');
    return close === -1 ? null : first.slice(1, close);
  }
  const host = first.split(':')[0] ?? '';
  return host.replace(/\.+$/, '') || null;
}

/** Env helpers shared by web middleware and API host resolution. */
export function trustProxyEnabled(env: {
  TRUST_PROXY?: string;
  TRUSTED_PROXY_HOPS?: string;
  NODE_ENV?: string;
} = typeof process !== 'undefined' ? process.env : {}): boolean {
  const flag = env.TRUST_PROXY?.trim().toLowerCase();
  if (flag === 'true' || flag === '1' || flag === 'yes') {
    return true;
  }
  if (flag === 'false' || flag === '0' || flag === 'no') {
    return false;
  }
  const hops = Number(env.TRUSTED_PROXY_HOPS ?? '');
  if (Number.isFinite(hops) && hops >= 1) {
    return true;
  }
  return false;
}

/**
 * Value for Express `trust proxy`: the number of reverse-proxy hops in front
 * of the API, or `false` when the API is reached directly. A hop count (not
 * `true`) makes `req.ip` the address the outermost trusted proxy saw, so a
 * client-supplied X-Forwarded-For prefix cannot choose its own IP.
 */
export function trustProxySetting(env: {
  TRUST_PROXY?: string;
  TRUSTED_PROXY_HOPS?: string;
} = typeof process !== 'undefined' ? process.env : {}): number | false {
  if (!trustProxyEnabled(env)) {
    return false;
  }
  const hops = Number(env.TRUSTED_PROXY_HOPS ?? '');
  return Number.isInteger(hops) && hops >= 1 ? hops : 1;
}

/**
 * Client IP for rate limiting and audit logs. Relies on Express `trust proxy`
 * (see trustProxySetting) instead of parsing X-Forwarded-For, which clients
 * control when no trusted proxy strips it.
 */
export function clientIp(req: {
  ip?: string;
  socket?: { remoteAddress?: string };
}): string | undefined {
  return req.ip || req.socket?.remoteAddress || undefined;
}

function isPrivateAddress(address: string): boolean {
  const ip = address.toLowerCase().replace(/^::ffff:/, '');
  if (ip === '::1') {
    return true;
  }
  if (/^f[cd][0-9a-f]{2}:/.test(ip)) {
    return true;
  }
  const octets = ip.split('.').map(Number);
  if (octets.length !== 4 || octets.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return false;
  }
  const [a = -1, b = -1] = octets;
  return (
    a === 10 ||
    a === 127 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

/**
 * A server-side read from another service on the private network (the web
 * storefront rendering pages), as opposed to a browser request. Behind the
 * trusted proxy every external request carries the X-Forwarded-For that nginx
 * sets, so only callers that reach the API port directly qualify. Without a
 * trusted proxy nothing qualifies, because the socket address is all we have.
 */
export function isInternalServiceRequest(
  req: {
    method?: string;
    headers?: Record<string, string | string[] | undefined>;
    socket?: { remoteAddress?: string };
  },
  trustProxy: boolean,
): boolean {
  if (!trustProxy) {
    return false;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return false;
  }
  if (req.headers?.['x-forwarded-for'] !== undefined) {
    return false;
  }
  const remote = req.socket?.remoteAddress;
  return Boolean(remote && isPrivateAddress(remote));
}
