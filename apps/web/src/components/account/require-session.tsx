'use client';

import { CloudOffIcon, LockIcon } from 'lucide-react';
import Link from 'next/link';
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
  const pathname = usePathname();
  const session = useSession();

  if (session.isPending) {
    return (
      <div className="grid gap-4" aria-busy="true" aria-label="Loading">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }
  if (session.isError) {
    return (
      <EmptyState
        icon={CloudOffIcon}
        title="We couldn’t load your account"
        description={userMessage(session.error)}
        action={
          <Button variant="outline" onClick={() => void session.refetch()}>
            Try again
          </Button>
        }
      />
    );
  }
  if (!session.data) {
    return (
      <EmptyState
        icon={LockIcon}
        title="Sign in to continue"
        description="Your orders, addresses and wishlist live in your account."
        action={
          <div className="flex gap-3">
            <Button asChild>
              <Link href={`/login?next=${encodeURIComponent(pathname)}`}>Sign in</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/register">Create account</Link>
            </Button>
          </div>
        }
      />
    );
  }
  return <>{children(session.data)}</>;
}
