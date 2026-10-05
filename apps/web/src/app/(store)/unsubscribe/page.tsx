import { Suspense } from 'react';
import { AuthCard } from '@/components/auth/auth-card';
import { UnsubscribePanel } from '@/components/notifications/email-link-panels';
import { privatePage } from '@/lib/seo/private';

export const metadata = privatePage('Unsubscribe');

export default function UnsubscribePage() {
  return (
    <AuthCard title="Unsubscribe" description="Stop these emails with one click.">
      <Suspense>
        <UnsubscribePanel />
      </Suspense>
    </AuthCard>
  );
}
