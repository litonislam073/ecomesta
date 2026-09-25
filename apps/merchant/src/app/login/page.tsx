import { Suspense } from 'react';
import LoginPage from './login-form';
import { LoadingState } from '@/components/ui/loading-state';

export default function LoginRoute() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-md p-8">
          <LoadingState label="Loading sign in" />
        </div>
      }
    >
      <LoginPage />
    </Suspense>
  );
}
