import { getI18n } from '@/lib/i18n/server';
import { Suspense } from 'react';
import { AuthCard } from '@/components/auth/auth-card';
import { UnsubscribePanel } from '@/components/notifications/email-link-panels';
import { localPrivatePage } from '@/lib/seo/private';

export const generateMetadata = localPrivatePage((t) => t.pages.unsubscribe);

export default async function UnsubscribePage() {
  const { t } = await getI18n();
  return (
    <AuthCard title={t.pages.unsubscribe} description={t.pages.unsubscribeDescription}>
      <Suspense>
        <UnsubscribePanel />
      </Suspense>
    </AuthCard>
  );
}
