'use client';

import { useId } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { userMessage } from '@/lib/api/errors';
import {
  useNotificationPreferences,
  useUpdateNotificationPreferences,
} from '@/lib/api/notifications';

/** Optional emails only: security and order receipts are always sent. */
export function EmailPreferences() {
  const preferences = useNotificationPreferences();
  const update = useUpdateNotificationPreferences();
  const orderUpdatesId = useId();
  const newsletterId = useId();

  if (preferences.isPending) return <Skeleton className="h-32" aria-label="Loading preferences" />;
  if (preferences.isError) {
    return <p className="text-sm text-destructive">{userMessage(preferences.error)}</p>;
  }
  const { orderUpdates, newsletter } = preferences.data;
  const newsletterOn = newsletter === 'SUBSCRIBED' || newsletter === 'PENDING';

  return (
    <section aria-labelledby="email-preferences" className="grid gap-5 rounded-2xl border p-6">
      <div>
        <h2 id="email-preferences" className="font-semibold">
          Email preferences
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Order confirmations, receipts and security emails are always sent.
        </p>
      </div>
      <div className="flex items-start gap-3">
        <Checkbox
          id={orderUpdatesId}
          checked={orderUpdates}
          disabled={update.isPending}
          onCheckedChange={(checked) => {
            update.mutate({ orderUpdates: checked === true });
          }}
        />
        <div className="grid gap-1">
          <Label htmlFor={orderUpdatesId}>Shipping updates</Label>
          <p className="text-sm text-muted-foreground">
            Tracking number when your order ships, and a note when it arrives.
          </p>
        </div>
      </div>
      <div className="flex items-start gap-3">
        <Checkbox
          id={newsletterId}
          checked={newsletterOn}
          disabled={update.isPending}
          onCheckedChange={(checked) => {
            update.mutate({ newsletter: checked === true });
          }}
        />
        <div className="grid gap-1">
          <Label htmlFor={newsletterId}>Newsletter</Label>
          <p className="text-sm text-muted-foreground">
            {newsletter === 'PENDING'
              ? 'Check your inbox: confirm the link we sent to start receiving it.'
              : 'One email a month with restocks, new boards and build guides.'}
          </p>
        </div>
      </div>
      {update.isError && (
        <p role="alert" className="text-sm text-destructive">
          {userMessage(update.error)}
        </p>
      )}
    </section>
  );
}
