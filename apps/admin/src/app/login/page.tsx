import { Suspense } from 'react';
import LoginForm from './login-form';
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
      <LoginForm />
    </Suspense>
  );
}
