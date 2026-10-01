import { indexableMarketingPaths } from '@ecomesta/utils/marketing-content';

/**
 * Last line of defence on model output: anything that looks like a secret,
 * connection string, internal host or our system prompt is never sent to the
 * visitor, whatever the conversation tricked the model into writing.
 */

/** Marker embedded in the system prompt; it must never appear in a reply. */
export const SYSTEM_PROMPT_CANARY = 'ECOMESTA-INTERNAL-7f3c91';

const BLOCKED_OUTPUT: RegExp[] = [
  new RegExp(SYSTEM_PROMPT_CANARY, 'i'),
  /\bsk-[A-Za-z0-9_-]{16,}/, // OpenAI-style keys
  /\b(postgres(ql)?|redis|mysql|mongodb):\/\//i, // connection strings
  /\b(DATABASE_URL|REDIS_URL|OPENAI_API_KEY|JWT_(ACCESS|REFRESH)_SECRET|SMTP_PASSWORD|PAYMENT_SECRETS)\b/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\b(?:localhost|127\.0\.0\.1|0\.0\.0\.0):\d{2,5}\b/i, // internal service addresses
  /\b(?:api|ecomesta)-(?:api|postgres|redis|web|merchant|admin)-\d\b/i, // container names
];

export function isUnsafeOutput(text: string): boolean {
  return BLOCKED_OUTPUT.some((pattern) => pattern.test(text));
}

const KNOWN_PATHS = new Set(indexableMarketingPaths());
const SITE_PATH = /(^|[\s(“"'])(\/(?:features|payments|shipping|solutions|blog|pricing|faq|about|contact|resources)(?:\/[a-z0-9-]+)?)\/?(?=$|[\s).,;:!?”"'।])/gm;
const OWN_SITE_URL = /https?:\/\/(?:www\.)?ecomesta\.com(?=\/)/gi;

/**
 * Keeps only links to pages that exist. An invented path such as
 * /features/custom-domains becomes its section page (/features), so the
 * visitor never lands on a 404.
 */
export function fixSitePaths(text: string): string {
  return text.replace(OWN_SITE_URL, '').replace(SITE_PATH, (match, lead: string, path: string) => {
    if (KNOWN_PATHS.has(path)) return match;
    const section = `/${path.split('/')[1]}`;
    return `${lead}${KNOWN_PATHS.has(section) ? section : '/'}`;
  });
}
