import { ApiError } from '@/lib/api-client';

export const CONNECTION_ERROR = 'Unable to connect right now. Please try again.';
export const INVALID_CREDENTIALS = 'Email or password is incorrect.';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim());
}

/**
 * User-facing text for a failed login/register call. API messages are already
 * sanitized by the API's exception filter; server faults and network failures
 * get a generic message so nothing internal reaches the page.
 */
export function authErrorMessage(
  error: unknown,
  action: 'login' | 'register' | 'recovery',
): { message: string; details?: string[] } {
  if (!(error instanceof ApiError) || error.status >= 500) {
    return { message: CONNECTION_ERROR };
  }
  if (action === 'login' && error.status === 401) {
    return { message: INVALID_CREDENTIALS };
  }
  const details = Array.isArray(error.details)
    ? error.details.filter((item): item is string => typeof item === 'string')
    : undefined;
  return { message: error.message, details: details?.length ? details : undefined };
}
