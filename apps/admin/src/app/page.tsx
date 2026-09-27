import { redirect } from 'next/navigation';

/** The dashboard layout bounces unauthenticated visitors on to /login. */
export default function HomePage() {
  redirect('/dashboard');
}
