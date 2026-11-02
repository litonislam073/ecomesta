export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

type TokenGetter = () => string | null;
type UnauthorizedHandler = () => void;
type RefreshHandler = () => Promise<string | null>;

let accessTokenGetter: TokenGetter = () => null;
let onUnauthorized: UnauthorizedHandler | null = null;
let refreshAccessToken: RefreshHandler | null = null;
let refreshInFlight: Promise<string | null> | null = null;

export function configureApiClient(options: {
  getAccessToken: TokenGetter;
  onUnauthorized?: UnauthorizedHandler;
  refreshAccessToken?: RefreshHandler;
}) {
  accessTokenGetter = options.getAccessToken;
  onUnauthorized = options.onUnauthorized ?? null;
  refreshAccessToken = options.refreshAccessToken ?? null;
}

function apiBaseUrl(): string {
  const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';
  return base.replace(/\/$/, '');
}

const NO_REFRESH_PATHS = new Set([
  '/auth/login',
  '/auth/register',
  '/auth/google',
  '/auth/providers',
  '/auth/refresh',
  '/auth/logout',
]);

async function tryRefreshAccessToken(): Promise<string | null> {
  if (!refreshAccessToken) {
    return null;
  }
  if (!refreshInFlight) {
    refreshInFlight = refreshAccessToken().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

export async function apiRequest<T>(
  path: string,
  options: {
    method?: HttpMethod;
    body?: unknown;
    token?: string | null;
    signal?: AbortSignal;
    /** Internal: already attempted one refresh retry. */
    _retried?: boolean;
  } = {},
): Promise<T> {
  const method = options.method ?? 'GET';
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Ecomesta-Client': 'merchant',
  };

  const token = options.token === undefined ? accessTokenGetter() : options.token;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let body: string | FormData | undefined;
  if (options.body instanceof FormData) {
    // The browser sets the multipart Content-Type (with boundary) itself.
    body = options.body;
  } else if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }

  const response = await fetch(`${apiBaseUrl()}${path}`, {
    method,
    headers,
    body,
    credentials: 'include',
    signal: options.signal,
  });

  let payload: unknown = null;
  const text = await response.text();
  if (text) {
    try {
      payload = JSON.parse(text) as unknown;
    } catch {
      throw new ApiError(response.status, 'INVALID_JSON', 'Unexpected response from server');
    }
  }

  if (!response.ok) {
    const errorBody = payload as {
      error?: { code?: string; message?: string; details?: unknown };
    } | null;
    const code = errorBody?.error?.code ?? `HTTP_${response.status}`;
    const message =
      errorBody?.error?.message ??
      (response.status === 401
        ? 'Your session has expired. Please sign in again.'
        : 'Request failed');

    if (
      response.status === 401 &&
      !options._retried &&
      !NO_REFRESH_PATHS.has(path) &&
      refreshAccessToken
    ) {
      const nextToken = await tryRefreshAccessToken();
      if (nextToken) {
        return apiRequest<T>(path, {
          ...options,
          token: nextToken,
          _retried: true,
        });
      }
    }

    if (response.status === 401 && onUnauthorized) {
      onUnauthorized();
    }

    throw new ApiError(response.status, code, message, errorBody?.error?.details);
  }

  return payload as T;
}

export const api = {
  get: <T>(path: string, init?: { token?: string | null; signal?: AbortSignal }) =>
    apiRequest<T>(path, { method: 'GET', ...init }),
  post: <T>(path: string, body?: unknown, init?: { token?: string | null }) =>
    apiRequest<T>(path, { method: 'POST', body, ...init }),
  patch: <T>(path: string, body?: unknown, init?: { token?: string | null }) =>
    apiRequest<T>(path, { method: 'PATCH', body, ...init }),
  put: <T>(path: string, body?: unknown, init?: { token?: string | null }) =>
    apiRequest<T>(path, { method: 'PUT', body, ...init }),
  delete: <T>(path: string, init?: { token?: string | null }) =>
    apiRequest<T>(path, { method: 'DELETE', ...init }),
  upload: <T>(path: string, form: FormData, init?: { token?: string | null }) =>
    apiRequest<T>(path, { method: 'POST', body: form, ...init }),
};

/** A file from the API (e.g. a CSV export), with the signed-in user's token. */
export async function apiDownload(path: string): Promise<{ blob: Blob; filename: string | null }> {
  const send = (token: string | null) =>
    fetch(`${apiBaseUrl()}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: 'include',
    });
  let response = await send(accessTokenGetter());
  if (response.status === 401) {
    const next = await tryRefreshAccessToken();
    if (next) response = await send(next);
  }
  if (!response.ok) {
    let message = 'Download failed';
    let code = `HTTP_${response.status}`;
    try {
      const body = (await response.json()) as { error?: { code?: string; message?: string } };
      message = body.error?.message ?? message;
      code = body.error?.code ?? code;
    } catch {
      // Not JSON.
    }
    throw new ApiError(response.status, code, message);
  }
  const disposition = response.headers.get('Content-Disposition') ?? '';
  const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? null;
  return { blob: await response.blob(), filename };
}
