import { getI18n } from '@/lib/i18n/server';
import Link from '@/components/i18n/link';
import { AuthCard } from '@/components/auth/auth-card';
import { RegisterForm } from '@/components/auth/register-form';
import { localPrivatePage } from '@/lib/seo/private';

export const generateMetadata = localPrivatePage((t) => t.pages.createAccount);

export default async function RegisterPage() {
  const { t } = await getI18n();
  return (
    <AuthCard
      title={t.pages.register.title}
      description={t.pages.register.description}
      footer={
        <>
          {t.pages.register.haveAccount}{' '}
          <Link
            href="/login"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            {t.pages.register.signIn}
          </Link>
        </>
      }
    >
      <RegisterForm />
    </AuthCard>
  );
}
