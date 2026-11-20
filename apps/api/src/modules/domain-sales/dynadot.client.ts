import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** What the registrar says about one domain name. */
export interface DomainAvailability {
  domain: string;
  available: boolean;
  premium: boolean;
  /** Price per year in USD; null when the registrar gave none (e.g. taken). */
  registerUsd: number | null;
  renewUsd: number | null;
}

export interface RegistrantContact {
  name: string;
  email: string;
  /** Digits only, without the country code. */
  phone: string;
  phoneCountryCode: string;
  address: string;
  city: string;
  state?: string;
  postcode: string;
  /** ISO 3166-1 alpha-2, e.g. BD. */
  country: string;
  organization?: string;
}

/** A registrar refusal (domain taken, low balance…), with Dynadot's message. */
export class RegistrarError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RegistrarError';
  }
}

/** Swappable in tests; production talks to Dynadot. */
export const DOMAIN_REGISTRAR = Symbol('DOMAIN_REGISTRAR');

export interface DomainRegistrar {
  readonly mode: 'sandbox' | 'production';
  search(domain: string): Promise<DomainAvailability>;
  createContact(contact: RegistrantContact): Promise<string>;
  register(domain: string, years: number, contactId: string): Promise<{ expiresAt: Date }>;
  renew(domain: string, years: number): Promise<{ expiresAt: Date }>;
  /** Points the domain at the platform: apex A record (when known) and `www` CNAME. */
  pointToPlatform(domain: string, target: { aRecord: string | null; cname: string }): Promise<void>;
  balanceUsd(): Promise<number | null>;
}

const MIN_GAP_MS = 1100;

/**
 * Dynadot's classic API (`api3.json`). A regular reseller account may send one
 * request at a time, one per second, so calls are queued. Searches always use
 * the production key when there is one, so prices are real even while
 * registrations go to the sandbox; registration, renewal and DNS use the key
 * for `DYNADOT_MODE` (sandbox unless set to "production").
 */
@Injectable()
export class DynadotClient implements DomainRegistrar {
  private readonly logger = new Logger(DynadotClient.name);
  readonly mode: 'sandbox' | 'production';
  private queue: Promise<unknown> = Promise.resolve();
  private lastCall = 0;

  constructor(private readonly config: ConfigService) {
    this.mode = config.get<string>('DYNADOT_MODE')?.trim().toLowerCase() === 'production' ? 'production' : 'sandbox';
  }

  private keyFor(kind: 'search' | 'order'): { key: string; base: string } {
    const production = this.config.get<string>('DYNADOT_API_KEY')?.trim();
    const sandbox = this.config.get<string>('DYNADOT_SANDBOX_API_KEY')?.trim();
    if (kind === 'search' && production) return { key: production, base: 'https://api.dynadot.com' };
    if (this.mode === 'production') {
      if (!production) throw new RegistrarError('Domain sales are not configured (DYNADOT_API_KEY missing).');
      return { key: production, base: 'https://api.dynadot.com' };
    }
    if (!sandbox) throw new RegistrarError('Domain sales are not configured (DYNADOT_SANDBOX_API_KEY missing).');
    return { key: sandbox, base: 'https://api-sandbox.dynadot.com' };
  }

  /** One classic command; resolves to the response object under its top-level key. */
  private call(kind: 'search' | 'order', command: string, params: Record<string, string>): Promise<Record<string, unknown>> {
    const run = async () => {
      const wait = this.lastCall + MIN_GAP_MS - Date.now();
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
      this.lastCall = Date.now();
      const { key, base } = this.keyFor(kind);
      const query = new URLSearchParams({ key, command, ...params });
      let body: unknown;
      try {
        const res = await fetch(`${base}/api3.json?${query.toString()}`, { signal: AbortSignal.timeout(30_000) });
        body = await res.json();
      } catch (err) {
        this.logger.warn(`Dynadot ${command} failed to respond: ${(err as Error).message}`);
        throw new RegistrarError('The domain registrar did not respond. Please try again.');
      }
      const top = body && typeof body === 'object' ? Object.values(body as Record<string, unknown>)[0] : null;
      const response = (top && typeof top === 'object' ? top : {}) as Record<string, unknown>;
      const header = (Object.entries(response).find(([name]) => name.endsWith('Header'))?.[1] ?? {}) as Record<string, unknown>;
      const code = String(response.ResponseCode ?? response.SuccessCode ?? header.SuccessCode ?? header.ResponseCode ?? '');
      const status = String(response.Status ?? header.Status ?? '');
      if (code === '-1' || status === 'error') {
        const message = String(response.Error ?? header.Error ?? 'The domain registrar refused the request.');
        throw new RegistrarError(message);
      }
      return response;
    };
    const next = this.queue.then(run, run);
    this.queue = next.catch(() => undefined);
    return next;
  }

  async search(domain: string): Promise<DomainAvailability> {
    const response = await this.call('search', 'search', { domain0: domain, show_price: '1', currency: 'USD' });
    const results = (response.SearchResults ?? response.SearchResult ?? []) as Array<Record<string, unknown>>;
    const row = results.find((r) => String(r.DomainName ?? '').toLowerCase() === domain) ?? results[0] ?? {};
    const price = String(row.Price ?? '');
    const amounts = [...price.matchAll(/([\d.]+)\s+in\s+USD/gi)].map((m) => Number(m[1]));
    return {
      domain,
      available: String(row.Available ?? '').toLowerCase() === 'yes',
      premium: /is a premium domain/i.test(price) && !/is not a premium domain/i.test(price),
      registerUsd: Number.isFinite(amounts[0]) ? amounts[0]! : null,
      renewUsd: Number.isFinite(amounts[1]) ? amounts[1]! : Number.isFinite(amounts[0]) ? amounts[0]! : null,
    };
  }

  async createContact(contact: RegistrantContact): Promise<string> {
    const response = await this.call('order', 'create_contact', {
      name: contact.name,
      email: contact.email,
      phonecc: contact.phoneCountryCode,
      phonenum: contact.phone,
      address1: contact.address,
      city: contact.city,
      state: contact.state ?? contact.city,
      zip: contact.postcode,
      country: contact.country,
      ...(contact.organization ? { organization: contact.organization } : {}),
    });
    const content = (response.CreateContactContent ?? response) as Record<string, unknown>;
    const id = String(content.ContactId ?? '');
    if (!id || id === '0') throw new RegistrarError('The registrar did not accept the contact details.');
    return id;
  }

  async register(domain: string, years: number, contactId: string): Promise<{ expiresAt: Date }> {
    const response = await this.call('order', 'register', {
      domain,
      duration: String(years),
      currency: 'USD',
      registrant_contact: contactId,
      admin_contact: contactId,
      technical_contact: contactId,
      billing_contact: contactId,
    });
    return { expiresAt: this.expiration(response, years) };
  }

  async renew(domain: string, years: number): Promise<{ expiresAt: Date }> {
    const response = await this.call('order', 'renew', { domain, duration: String(years), currency: 'USD' });
    return { expiresAt: this.expiration(response, years) };
  }

  async pointToPlatform(domain: string, target: { aRecord: string | null; cname: string }): Promise<void> {
    const params: Record<string, string> = {
      domain,
      subdomain0: 'www',
      sub_record_type0: 'cname',
      sub_record0: target.cname,
    };
    if (target.aRecord) {
      params.main_record_type0 = 'a';
      params.main_record0 = target.aRecord;
    }
    await this.call('order', 'set_dns2', params);
  }

  async balanceUsd(): Promise<number | null> {
    try {
      const response = await this.call('order', 'get_account_balance', {});
      const list = (response.BalanceList ?? (response.GetAccountBalanceContent as Record<string, unknown> | undefined)?.BalanceList ?? []) as Array<
        Record<string, unknown>
      >;
      const usd = list.find((b) => b.Currency === 'USD');
      return usd ? Number(usd.Amount) : 0;
    } catch (err) {
      if (err instanceof RegistrarError && /no balance/i.test(err.message)) return 0;
      throw err;
    }
  }

  /** Expiry from the response (Unix ms), or the period from now if it is missing. */
  private expiration(response: Record<string, unknown>, years: number): Date {
    const content = (response.RegisterContent ?? response.RenewContent ?? response) as Record<string, unknown>;
    const ms = Number(content.Expiration ?? response.Expiration);
    if (Number.isFinite(ms) && ms > 0) return new Date(ms);
    const fallback = new Date();
    fallback.setFullYear(fallback.getFullYear() + years);
    return fallback;
  }
}
