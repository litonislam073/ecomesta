/**
 * How a guest proves an order is theirs: the checkout email, or the phone
 * number when they ordered without an email. The API accepts either.
 *
 * The proof never goes in a URL (address bar, history, redirects, analytics,
 * referrers, access logs). It travels in POST bodies, and after checkout it is
 * kept in this tab's sessionStorage so the confirmation and payment-result
 * pages can load the order again — including after a refresh or a payment
 * provider redirect. Anyone without it is asked for it and checked by the API.
 */
import type { PublicOrderConfirmationDetail } from '@ecomesta/types';
import { publicPost } from '@/lib/public-api';

export type OrderContact = { email?: string | null; phone?: string | null };

/** Loads a guest order; the contact proof goes in the body, never the URL. */
export async function lookupPublicOrder(
  storeSlug: string,
  reference: string,
  contact: OrderContact,
): Promise<PublicOrderConfirmationDetail> {
  const result = await publicPost<{ success: true; data: PublicOrderConfirmationDetail }>(
    `/public/stores/${encodeURIComponent(storeSlug)}/orders/${encodeURIComponent(reference)}/lookup`,
    contactProof(contact) ?? {},
  );
  return result.data;
}

/** The contact to send: the email when there is one, otherwise the phone. */
export function contactProof(contact: OrderContact): { email: string } | { phone: string } | null {
  const email = contact.email?.trim();
  if (email) return { email };
  const phone = contact.phone?.trim();
  if (phone) return { phone };
  return null;
}

/** One input field: anything with an @ is the checkout email, otherwise the phone. */
export function parseContactInput(value: string): OrderContact | null {
  const trimmed = value.trim();
  if (trimmed.includes('@')) return { email: trimmed.toLowerCase() };
  if (trimmed.replace(/\D/g, '').length < 6) return null;
  return { phone: trimmed };
}

const storageKey = (storeSlug: string, reference: string) =>
  `ecomesta_order_contact:${storeSlug}:${reference}`;

/** Remembers the checkout contact for this order, in this tab only. */
export function rememberOrderContact(storeSlug: string, reference: string, contact: OrderContact) {
  const proof = contactProof(contact);
  if (!proof) return;
  try {
    window.sessionStorage.setItem(storageKey(storeSlug, reference), JSON.stringify(proof));
  } catch {
    /* storage unavailable: the page asks for the contact instead */
  }
}

/** The contact remembered for this order in this tab, if any. */
export function recallOrderContact(storeSlug: string, reference: string): OrderContact | null {
  try {
    const raw = window.sessionStorage.getItem(storageKey(storeSlug, reference));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OrderContact;
    return contactProof(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Links issued before contact details left URLs still carry `email` / `phone`.
 * Takes them (so the page keeps working) and returns the URL without them, or
 * null when there was nothing to strip.
 */
export function takeLegacyContact(href: string): { contact: OrderContact; cleanUrl: string } | null {
  const url = new URL(href);
  const email = url.searchParams.get('email')?.trim() || null;
  const phone = url.searchParams.get('phone')?.trim() || null;
  if (!email && !phone) return null;
  url.searchParams.delete('email');
  url.searchParams.delete('phone');
  return { contact: { email, phone }, cleanUrl: `${url.pathname}${url.search}${url.hash}` };
}
