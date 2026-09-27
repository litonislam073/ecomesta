import { redirect } from 'next/navigation';
import { loginUrl } from '@/lib/marketing/site';

export const dynamic = 'force-dynamic';

export const metadata = { robots: { index: false, follow: false } };

export default function LoginRedirect() {
  redirect(loginUrl());
}
