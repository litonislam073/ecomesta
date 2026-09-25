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

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

type TokenGetter = () => string | null;
type UnauthorizedHandler = () => void;

let accessTokenGetter: TokenGetter = () => null;
let onUnauthorized: UnauthorizedHandler | null = null;

export function configureApiClient(options: {
  getAccessToken: TokenGetter;
  onUnauthorized?: UnauthorizedHandler;
}) {
  accessTokenGetter = options.getAccessToken;
  onUnauthorized = options.onUnauthorized ?? null;
}

function apiBaseUrl(): string {
  const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';
  return base.replace(/\/$/, '');
}

export async function apiRequest<T>(
  path: string,
  options: {
    method?: HttpMethod;
    body?: unknown;
    token?: string | null;
    signal?: AbortSignal;
  } = {},
): Promise<T> {
  const method = options.method ?? 'GET';
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  const token = options.token === undefined ? accessTokenGetter() : options.token;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let body: string | undefined;
  if (options.body !== undefined) {
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
  delete: <T>(path: string, init?: { token?: string | null }) =>
    apiRequest<T>(path, { method: 'DELETE', ...init }),
};
