'use client';

import { HeartIcon } from 'lucide-react';
import Link from 'next/link';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { RequireSession } from './require-session';

export function WishlistView() {
  return (
    <RequireSession>
      {() => (
        <EmptyState
          icon={HeartIcon}
          title="Your wishlist is empty"
          description="Tap the heart on any product to save it here."
          action={
            <Button asChild>
              <Link href="/shop">Browse products</Link>
            </Button>
          }
        />
      )}
    </RequireSession>
  );
}
