'use client';

import { BACK_OFFICE_ROLES, hasAnyRole } from '@market/types';
import { ShieldAlertIcon } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { RequireSession } from '@/components/account/require-session';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';

/**
 * UX gate only. Real enforcement happens server-side: the gateway rejects admin
 * API calls without a STAFF/ADMIN role, and the request proxy (auth phase)
 * redirects unauthenticated /admin page requests.
 */
export function RequireStaff({ children }: { children: ReactNode }) {
  return (
    <RequireSession>
      {(user) =>
        hasAnyRole(user.roles, BACK_OFFICE_ROLES) ? (
          children
        ) : (
          <EmptyState
            icon={ShieldAlertIcon}
            title="You don’t have access"
            description="The back office is limited to staff accounts."
            action={
              <Button variant="outline" asChild>
                <Link href="/">Back to store</Link>
              </Button>
            }
          />
        )
      }
    </RequireSession>
  );
}
