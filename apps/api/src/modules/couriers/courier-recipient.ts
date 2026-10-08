/**
 * Bangladeshi mobile number in the 11-digit local form couriers expect
 * (01XXXXXXXXX), or null when the number cannot be read as one. Accepts the
 * forms customers type: spaces/dashes, +880 / 880 prefix, or a missing 0.
 */
export function normalizeBdMobile(input: string | null | undefined): string | null {
  const digits = (input ?? '').replace(/\D/g, '');
  let local: string;
  if (digits.length === 13 && digits.startsWith('880')) local = `0${digits.slice(3)}`;
  else if (digits.length === 11 && digits.startsWith('0')) local = digits;
  else if (digits.length === 10 && digits.startsWith('1')) local = `0${digits}`;
  else return null;
  return /^01[3-9]\d{8}$/.test(local) ? local : null;
}

/** One-line delivery address from an order address snapshot. */
export function formatDeliveryAddress(address: {
  addressLine1: string;
  addressLine2: string | null;
  landmark: string | null;
  upazilaName: string | null;
  districtName: string | null;
  city: string;
  postalCode: string | null;
}): string {
  const parts = [
    address.addressLine1,
    address.addressLine2,
    address.landmark ? `Near ${address.landmark}` : null,
    address.upazilaName,
    address.districtName ?? address.city,
    address.postalCode,
  ];
  const seen = new Set<string>();
  return parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part) && part !== 'N/A')
    .filter((part) => {
      const key = part.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join(', ');
}
