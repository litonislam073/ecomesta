import { Suspense } from 'react';
import type { Metadata } from 'next';
import { OnboardingShell } from '@/components/onboarding/onboarding-shell';
import { LoadingState } from '@/components/ui/loading-state';
import OnboardForm from './onboard-form';

export const metadata: Metadata = {
  title: 'Set up your store · Ecomesta',
  description: 'Name your Ecomesta store and choose its web address.',
  robots: { index: false, follow: false },
};

/** Full-page store setup: the form uses the whole width, no marketing column. */
export default function OnboardRoute() {
  return (
    <OnboardingShell>
      <section className="relative isolate">
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_left,rgba(1,135,240,0.10),transparent_55%),radial-gradient(ellipse_at_bottom_right,rgba(3,165,129,0.08),transparent_50%)]"
        />
        <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12 lg:py-14">
          <Suspense fallback={<LoadingState label="Loading store setup" />}>
            <OnboardForm />
          </Suspense>
        </div>
      </section>
    </OnboardingShell>
  );
}
