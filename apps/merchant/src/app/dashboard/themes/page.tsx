import { redirect } from 'next/navigation';

/** Legacy placeholder route; theme customization lives at /dashboard/theme. */
export default function Page() {
  redirect('/dashboard/theme');
}
