import { AuthCard } from '@/components/auth/auth-card';
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';
import { privatePage } from '@/lib/seo/private';

export const metadata = privatePage('Reset password');

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="Reset your password"
      description="We will email you a link to choose a new password."
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
