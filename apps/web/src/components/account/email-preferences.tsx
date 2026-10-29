'use client';

import { useI18n } from '@/components/i18n/provider';
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
  const { t } = useI18n();
  const preferences = useNotificationPreferences();
  const update = useUpdateNotificationPreferences();
  const orderUpdatesId = useId();
  const newsletterId = useId();

  if (preferences.isPending)
    return <Skeleton className="h-32" aria-label={t.account.preferences.loading} />;
  if (preferences.isError) {
    return <p className="text-sm text-destructive">{userMessage(preferences.error, t)}</p>;
  }
  const { orderUpdates, newsletter } = preferences.data;
  const newsletterOn = newsletter === 'SUBSCRIBED' || newsletter === 'PENDING';

  return (
    <section aria-labelledby="email-preferences" className="grid gap-5 rounded-2xl border p-6">
      <div>
        <h2 id="email-preferences" className="font-semibold">
          {t.account.preferences.title}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t.account.preferences.always}</p>
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
          <Label htmlFor={orderUpdatesId}>{t.account.preferences.shipping}</Label>
          <p className="text-sm text-muted-foreground">{t.account.preferences.shippingBody}</p>
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
          <Label htmlFor={newsletterId}>{t.account.preferences.newsletter}</Label>
          <p className="text-sm text-muted-foreground">
            {newsletter === 'PENDING'
              ? t.account.preferences.newsletterPending
              : t.account.preferences.newsletterBody}
          </p>
        </div>
      </div>
      {update.isError && (
        <p role="alert" className="text-sm text-destructive">
          {userMessage(update.error, t)}
        </p>
      )}
    </section>
  );
}
