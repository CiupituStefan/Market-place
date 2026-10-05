import { Suspense } from 'react';
import { AuthCard } from '@/components/auth/auth-card';
import { VerifyEmailPanel } from '@/components/auth/verify-email-panel';
import { privatePage } from '@/lib/seo/private';

export const metadata = privatePage('Confirm your email');

export default function VerifyEmailPage() {
  return (
    <AuthCard title="Confirm your email" description="One click and your account is fully set up.">
      <Suspense>
        <VerifyEmailPanel />
      </Suspense>
    </AuthCard>
  );
}
