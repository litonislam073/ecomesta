import { Injectable } from '@nestjs/common';

export type SteadfastHttpResponse = { status: number; body: unknown };

/** Thrown when Steadfast could not be reached or did not answer in time. */
export class SteadfastTransportError extends Error {
  constructor(readonly kind: 'timeout' | 'network') {
    super(`Steadfast ${kind}`);
  }
}

const TIMEOUT_MS = 15_000;

/**
 * Thin fetch wrapper for Steadfast's API. Injectable so tests can replace the
 * network. Never logs or rethrows request headers (they carry the API key and
 * secret key) or bodies.
 */
@Injectable()
export class SteadfastHttp {
  async request(params: {
    method: 'GET' | 'POST';
    url: string;
    apiKey: string;
    secretKey: string;
    body?: Record<string, unknown>;
  }): Promise<SteadfastHttpResponse> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(params.url, {
        method: params.method,
        headers: {
          'Api-Key': params.apiKey,
          'Secret-Key': params.secretKey,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: params.body ? JSON.stringify(params.body) : undefined,
        signal: controller.signal,
      });
    } catch {
      throw new SteadfastTransportError(controller.signal.aborted ? 'timeout' : 'network');
    } finally {
      clearTimeout(timer);
    }
    const text = await res.text().catch(() => '');
    let body: unknown = null;
    if (text) {
      try {
        body = JSON.parse(text) as unknown;
      } catch {
        body = null;
      }
    }
    return { status: res.status, body };
  }
}
