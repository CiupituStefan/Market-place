import { getI18n } from '@/lib/i18n/server';
import { AuthCard } from '@/components/auth/auth-card';
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';
import { localPrivatePage } from '@/lib/seo/private';

export const generateMetadata = localPrivatePage((t) => t.pages.resetPassword);

export default async function ForgotPasswordPage() {
  const { t } = await getI18n();
  return (
    <AuthCard title={t.pages.forgot.title} description={t.pages.forgot.description}>
      <ForgotPasswordForm />
    </AuthCard>
  );
}
