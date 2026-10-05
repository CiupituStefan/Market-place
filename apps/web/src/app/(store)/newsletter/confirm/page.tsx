import { Suspense } from 'react';
import { AuthCard } from '@/components/auth/auth-card';
import { ConfirmNewsletterPanel } from '@/components/notifications/email-link-panels';
import { privatePage } from '@/lib/seo/private';

export const metadata = privatePage('Confirm your subscription');

export default function ConfirmNewsletterPage() {
  return (
    <AuthCard
      title="Confirm your subscription"
      description="One email a month: restocks, new boards and build guides."
    >
      <Suspense>
        <ConfirmNewsletterPanel />
      </Suspense>
    </AuthCard>
  );
}
