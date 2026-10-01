/**
 * How a guest proves an order is theirs: the checkout email, or the phone
 * number when they ordered without an email. The API accepts either.
 */
export type OrderContact = { email?: string | null; phone?: string | null };

/** The contact to send: the email when there is one, otherwise the phone. */
export function contactProof(contact: OrderContact): { email: string } | { phone: string } | null {
  const email = contact.email?.trim();
  if (email) return { email };
  const phone = contact.phone?.trim();
  if (phone) return { phone };
  return null;
}

/** `email=…` or `phone=…` (without a leading `?`/`&`), or '' when there is no contact. */
export function contactQuery(contact: OrderContact): string {
  const proof = contactProof(contact);
  if (!proof) return '';
  return 'email' in proof
    ? `email=${encodeURIComponent(proof.email)}`
    : `phone=${encodeURIComponent(proof.phone)}`;
}

/** Reads `email` / `phone` from URL search params (either shape Next.js provides). */
export function readContact(
  params: URLSearchParams | Record<string, string | string[] | undefined>,
): OrderContact {
  const get = (key: string) => {
    const value = params instanceof URLSearchParams ? params.get(key) : params[key];
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  };
  return { email: get('email'), phone: get('phone') };
}
