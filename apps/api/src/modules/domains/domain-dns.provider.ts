import { Injectable } from '@nestjs/common';
import { promises as dns } from 'dns';

/** Injection token so tests can swap in a deterministic DNS stub. */
export const DOMAIN_DNS_PROVIDER = 'DOMAIN_DNS_PROVIDER';

export interface DomainDnsProvider {
  /** Returns every TXT value published at `hostname`, or `[]` when unresolved. */
  lookupTxt(hostname: string): Promise<string[]>;
}

@Injectable()
export class SystemDnsProvider implements DomainDnsProvider {
  async lookupTxt(hostname: string): Promise<string[]> {
    let records: string[][];
    try {
      records = await dns.resolveTxt(hostname);
    } catch {
      // NXDOMAIN / no TXT / timeout all mean "not verified yet", not an outage.
      return [];
    }

    // Long TXT values arrive split into 255-byte chunks; providers differ on
    // whether the token lands in one chunk or is reassembled, so expose both.
    const values = new Set<string>();
    for (const chunks of records) {
      values.add(chunks.join(''));
      for (const chunk of chunks) {
        values.add(chunk);
      }
    }
    return [...values];
  }
}
