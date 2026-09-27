import { ApiError } from '@/lib/api-client';

export type OnboardField = 'businessName' | 'storeName' | 'storeSlug' | 'tenantSlug';
export type OnboardFieldErrors = Partial<Record<OnboardField, string>>;

export const CREATE_STORE_ERROR = 'Unable to create your store right now. Please try again.';
export const CHECK_FIELDS = 'Please check the highlighted fields.';
export const SLUG_TAKEN = 'That store URL is already in use. Try another one.';
export const SESSION_EXPIRED = 'Your session has expired. Please sign in again.';

export const SLUG_HINT = 'Use Latin letters or numbers, with hyphens between words (for example: my-store).';
export const STORE_SLUG_TOO_LONG = 'Store URL must be 63 characters or fewer.';

export const FIELD_MESSAGES: Record<OnboardField, string> = {
  businessName: 'Enter a business name between 2 and 120 characters.',
  storeName: 'Enter a store name between 2 and 120 characters.',
  storeSlug: SLUG_HINT,
  tenantSlug: SLUG_HINT,
};

const FIELDS = Object.keys(FIELD_MESSAGES) as OnboardField[];

/**
 * Safe text for a failed POST /onboarding/store. Validation details name the
 * DTO property first ("storeSlug must match …"), which is all we read from them;
 * the raw text is never shown.
 */
export function onboardingErrorMessage(
  error: unknown,
  { tenantSlugEdited }: { tenantSlugEdited: boolean },
): { message: string; fieldErrors: OnboardFieldErrors } {
  if (!(error instanceof ApiError) || error.status >= 500) {
    return { message: CREATE_STORE_ERROR, fieldErrors: {} };
  }
  if (error.status === 401) {
    return { message: SESSION_EXPIRED, fieldErrors: {} };
  }
  if (error.status === 409) {
    return {
      message: SLUG_TAKEN,
      fieldErrors: tenantSlugEdited ? { tenantSlug: SLUG_TAKEN } : { storeSlug: SLUG_TAKEN },
    };
  }
  if (error.status === 400) {
    const fieldErrors: OnboardFieldErrors = {};
    const details = Array.isArray(error.details) ? error.details : [];
    for (const detail of details) {
      if (typeof detail !== 'string') continue;
      const field = FIELDS.find((name) => detail.startsWith(`${name} `));
      if (field) fieldErrors[field] = FIELD_MESSAGES[field];
    }
    if (fieldErrors.tenantSlug && !tenantSlugEdited) {
      fieldErrors.storeSlug = fieldErrors.tenantSlug;
      delete fieldErrors.tenantSlug;
    }
    return { message: CHECK_FIELDS, fieldErrors };
  }
  return { message: CREATE_STORE_ERROR, fieldErrors: {} };
}
