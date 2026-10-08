/** Same rules as the API: tracking IDs only, never scripts. */
export const TRACKING_PATTERNS = {
  pixel: /^\d{8,20}$/,
  gtm: /^GTM-[A-Z0-9]{4,12}$/,
  ga4: /^G-[A-Z0-9]{4,16}$/,
  verification: /^[A-Za-z0-9_-]{10,100}$/,
} as const;

/** Search Console gives a whole meta tag; the code inside it is what is stored. */
export function verificationCode(input: string): string {
  const value = input.trim();
  const fromTag = /content\s*=\s*["']([^"']+)["']/i.exec(value);
  return fromTag ? fromTag[1]!.trim() : value;
}
