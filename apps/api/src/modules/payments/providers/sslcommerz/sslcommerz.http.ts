import { Injectable } from '@nestjs/common';

export type SslCommerzHttpResponse = {
  status: number;
  body: unknown;
};

/**
 * Thin fetch wrapper for SSLCommerz HTTP calls.
 * Injectable so e2e/unit tests can mock network I/O.
 * Never logs request bodies (may contain store_passwd).
 */
@Injectable()
export class SslCommerzHttp {
  async postForm(
    url: string,
    fields: Record<string, string>,
  ): Promise<SslCommerzHttpResponse> {
    const body = new URLSearchParams(fields).toString();
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    return {
      status: res.status,
      body: await this.parseResponseBody(res),
    };
  }

  async getJson(
    url: string,
    query: Record<string, string>,
  ): Promise<SslCommerzHttpResponse> {
    const target = new URL(url);
    for (const [key, value] of Object.entries(query)) {
      target.searchParams.set(key, value);
    }
    const res = await fetch(target.toString(), { method: 'GET' });
    return {
      status: res.status,
      body: await this.parseResponseBody(res),
    };
  }

  private async parseResponseBody(res: Response): Promise<unknown> {
    const text = await res.text();
    if (!text) return null;
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return text;
    }
  }
}
