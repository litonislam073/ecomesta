import { redirect } from 'next/navigation';

/** Marketing & tracking moved to the Marketing menu; old links keep working. */
export default function OldTrackingSettingsPage() {
  redirect('/dashboard/tracking');
}
