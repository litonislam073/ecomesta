/**
 * Shared pure utilities. Keep free of framework and environment coupling.
 */

export * from './billing.js';
export * from './theme-fonts.js';
export * from './theme-menu.js';

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function assertNever(value: never, message = 'Unexpected value'): never {
  throw new Error(`${message}: ${String(value)}`);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function parseCorsOrigins(raw: string | undefined): string[] {
  if (!raw || raw.trim().length === 0) {
    return [];
  }

  return raw
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

export function toIsoTimestamp(date: Date = new Date()): string {
  return date.toISOString();
}
