import { getI18n } from '@/lib/i18n/server';
import { Suspense } from 'react';
import { AuthCard } from '@/components/auth/auth-card';
import { ResetPasswordForm } from '@/components/auth/reset-password-form';
import { localPrivatePage } from '@/lib/seo/private';

export const generateMetadata = localPrivatePage((t) => t.pages.chooseNewPassword);

export default async function ResetPasswordPage() {
  const { t } = await getI18n();
  return (
    <AuthCard title={t.pages.reset.title} description={t.pages.reset.description}>
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </AuthCard>
  );
}
