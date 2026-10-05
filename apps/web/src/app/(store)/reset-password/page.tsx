import { Suspense } from 'react';
import { AuthCard } from '@/components/auth/auth-card';
import { ResetPasswordForm } from '@/components/auth/reset-password-form';
import { privatePage } from '@/lib/seo/private';

export const metadata = privatePage('Choose a new password');

export default function ResetPasswordPage() {
  return (
    <AuthCard
      title="Choose a new password"
      description="Use a long passphrase you don’t use anywhere else."
    >
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </AuthCard>
  );
}
