import { redirect } from 'next/navigation';
import { registerUrl } from '@/lib/marketing/site';

export const dynamic = 'force-dynamic';

export const metadata = { robots: { index: false, follow: false } };

export default function RegisterRedirect() {
  redirect(registerUrl());
}
