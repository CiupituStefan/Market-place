import { getI18n } from '@/lib/i18n/server';
import Link from '@/components/i18n/link';
import { Suspense } from 'react';
import { AuthCard } from '@/components/auth/auth-card';
import { LoginForm } from '@/components/auth/login-form';
import { localPrivatePage } from '@/lib/seo/private';

export const generateMetadata = localPrivatePage((t) => t.pages.signIn);

export default async function LoginPage() {
  const { t } = await getI18n();
  return (
    <AuthCard
      title={t.pages.login.title}
      description={t.pages.login.description}
      footer={
        <>
          {t.pages.login.newHere}{' '}
          <Link
            href="/register"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            {t.pages.login.create}
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
