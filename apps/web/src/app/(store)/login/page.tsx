import Link from 'next/link';
import { Suspense } from 'react';
import { AuthCard } from '@/components/auth/auth-card';
import { LoginForm } from '@/components/auth/login-form';
import { privatePage } from '@/lib/seo/private';

export const metadata = privatePage('Sign in');

export default function LoginPage() {
  return (
    <AuthCard
      title="Welcome back"
      description="Sign in to track orders and check out faster."
      footer={
        <>
          New to CSE?{' '}
          <Link
            href="/register"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Create an account
          </Link>
        </>
      }
    >
      {/* LoginForm reads ?next= from the URL. */}
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthCard>
  );
}
