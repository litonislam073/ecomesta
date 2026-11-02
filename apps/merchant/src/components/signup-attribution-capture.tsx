'use client';

import { useEffect } from 'react';
import { rememberReferralCode } from '@/lib/referral';
import { rememberSignupAttribution } from '@/lib/signup-attribution';

/** Remembers first-touch UTM/referrer and any `?ref=` on auth pages. */
export function SignupAttributionCapture() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    rememberReferralCode(params.get('ref'));
    rememberSignupAttribution();
  }, []);
  return null;
}
