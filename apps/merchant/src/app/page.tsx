/**
 * Root `/` is handled by `src/middleware.ts` (session → /dashboard, else /login).
 * This page is only a fallback if middleware is bypassed.
 */
export default function HomePage() {
  return null;
}
