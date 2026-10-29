'use client';

import { CloudOffIcon, LockIcon } from 'lucide-react';
import Link from '@/components/i18n/link';
import { useI18n } from '@/components/i18n/provider';
import { splitLocale } from '@/lib/i18n/config';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { userMessage } from '@/lib/api/errors';
import { useSession, type SessionUser } from '@/lib/api/session';

/**
 * Client-side gate for account pages (UX only). Authorization is enforced by the
 * API gateway and services; this component never decides what data a user may see.
 */
export function RequireSession({ children }: { children: (user: SessionUser) => ReactNode }) {
  const { t, path } = useI18n();
  const pathname = path(splitLocale(usePathname()).path);
  const session = useSession();

  if (session.isPending) {
    return (
      <div className="grid gap-4" aria-busy="true" aria-label={t.account.loading}>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }
  if (session.isError) {
    return (
      <EmptyState
        icon={CloudOffIcon}
        title={t.account.loadFailed}
        description={userMessage(session.error, t)}
        action={
          <Button variant="outline" onClick={() => void session.refetch()}>
            {t.common.tryAgain}
          </Button>
        }
      />
    );
  }
  if (!session.data) {
    return (
      <EmptyState
        icon={LockIcon}
        title={t.account.signInTitle}
        description={t.account.signInBody}
        action={
          <div className="flex gap-3">
            <Button asChild>
              <Link href={`/login?next=${encodeURIComponent(pathname)}`} prefetch={false}>
                {t.account.signIn}
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/register">{t.account.createAccount}</Link>
            </Button>
          </div>
        }
      />
    );
  }
  return <>{children(session.data)}</>;
}
