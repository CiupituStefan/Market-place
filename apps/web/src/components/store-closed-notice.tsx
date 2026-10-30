'use client';

import { BellIcon } from 'lucide-react';
import Link from '@/components/i18n/link';
import { useI18n } from '@/components/i18n/provider';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Shown instead of "Add to cart" and checkout while the shop is in preview (NEXT_PUBLIC_STORE_OPEN
 * =false). The order API refuses checkouts too (ORDERS_ENABLED=false); this only explains why.
 */
export function StoreClosedNotice({ className }: { className?: string }) {
  const { t } = useI18n();
  const copy = t.layout.storeClosed;
  return (
    <div
      role="status"
      className={cn('grid gap-3 rounded-2xl border bg-muted/40 p-4 text-sm', className)}
    >
      <p className="font-medium">{copy.title}</p>
      <p className="text-muted-foreground">{copy.body}</p>
      <Button asChild variant="outline" className="w-fit">
        <Link href="/#newsletter">
          <BellIcon /> {copy.notify}
        </Link>
      </Button>
    </div>
  );
}
