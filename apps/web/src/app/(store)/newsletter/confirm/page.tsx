import { getI18n } from '@/lib/i18n/server';
import { Suspense } from 'react';
import { AuthCard } from '@/components/auth/auth-card';
import { ConfirmNewsletterPanel } from '@/components/notifications/email-link-panels';
import { localPrivatePage } from '@/lib/seo/private';

export const generateMetadata = localPrivatePage((t) => t.pages.confirmSubscription);

export default async function ConfirmNewsletterPage() {
  const { t } = await getI18n();
  return (
    <AuthCard title={t.pages.confirmSubscription} description={t.pages.newsletter.description}>
      <Suspense>
        <ConfirmNewsletterPanel />
      </Suspense>
    </AuthCard>
  );
}
