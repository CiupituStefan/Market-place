import { getI18n } from '@/lib/i18n/server';
import { Suspense } from 'react';
import { AuthCard } from '@/components/auth/auth-card';
import { VerifyEmailPanel } from '@/components/auth/verify-email-panel';
import { localPrivatePage } from '@/lib/seo/private';

export const generateMetadata = localPrivatePage((t) => t.pages.confirmEmail);

export default async function VerifyEmailPage() {
  const { t } = await getI18n();
  return (
    <AuthCard title={t.pages.confirmEmail} description={t.pages.verify.description}>
      <Suspense>
        <VerifyEmailPanel />
      </Suspense>
    </AuthCard>
  );
}
