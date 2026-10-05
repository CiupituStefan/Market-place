import Link from 'next/link';
import { AuthCard } from '@/components/auth/auth-card';
import { RegisterForm } from '@/components/auth/register-form';
import { privatePage } from '@/lib/seo/private';

export const metadata = privatePage('Create account');

export default function RegisterPage() {
  return (
    <AuthCard
      title="Create your account"
      description="Save your builds, track orders and get early access to drops."
      footer={
        <>
          Already have an account?{' '}
          <Link
            href="/login"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </>
      }
    >
      <RegisterForm />
    </AuthCard>
  );
}
