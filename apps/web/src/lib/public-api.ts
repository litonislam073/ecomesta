export class PublicApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'PublicApiError';
    this.status = status;
    this.code = code;
  }
}

/**
 * Server-side renders call the API over the private network when
 * API_INTERNAL_URL is set; browsers always use the public URL.
 */
export function apiBaseUrl(): string {
  const internal =
    typeof window === 'undefined' ? process.env.API_INTERNAL_URL?.trim() : undefined;
  const base =
    internal || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
  return base.replace(/\/$/, '');
}

async function parseResponse<T>(response: Response): Promise<T> {
  let payload: unknown = null;
  const text = await response.text();
  if (text) {
    try {
      payload = JSON.parse(text) as unknown;
    } catch {
      throw new PublicApiError(response.status, 'INVALID_JSON', 'Unexpected response from server');
    }
  }

  if (!response.ok) {
    const body = payload as {
      error?: { code?: string; message?: string };
      message?: string | string[];
    } | null;
    const message =
      body?.error?.message ??
      (Array.isArray(body?.message) ? body.message.join(', ') : body?.message) ??
      (response.status === 404 ? 'Not found' : 'Request failed');
    throw new PublicApiError(
      response.status,
      body?.error?.code ?? `HTTP_${response.status}`,
      message,
    );
  }

  return payload as T;
}

export async function publicGet<T>(
  path: string,
  init?: { signal?: AbortSignal; fresh?: boolean },
): Promise<T> {
  const response = await fetch(`${apiBaseUrl()}${path}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal: init?.signal,
    ...(init?.fresh ? { cache: 'no-store' as const } : { next: { revalidate: 30 } }),
  });
  return parseResponse<T>(response);
}

export async function publicPost<T>(
  path: string,
  body: unknown,
  init?: { signal?: AbortSignal; idempotencyKey?: string },
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  if (init?.idempotencyKey) {
    headers['Idempotency-Key'] = init.idempotencyKey;
  }

  const response = await fetch(`${apiBaseUrl()}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: init?.signal,
    cache: 'no-store',
  });
  return parseResponse<T>(response);
}
