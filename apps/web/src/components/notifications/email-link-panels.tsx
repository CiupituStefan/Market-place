'use client';

import { CheckCircle2Icon } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import type { ReactNode } from 'react';
import Link from '@/components/i18n/link';
import { useI18n } from '@/components/i18n/provider';
import { Button } from '@/components/ui/button';
import { userMessage } from '@/lib/api/errors';
import { useConfirmNewsletter, useUnsubscribe } from '@/lib/api/notifications';

/**
 * Links from emails act only on a click: security scanners open links
 * automatically, and a GET that acted would do it on the scanner's behalf.
 */
function EmailLinkAction({
  action,
  label,
  pendingLabel,
  done,
}: {
  action: {
    mutate: (token: string) => void;
    isPending: boolean;
    isError: boolean;
    isSuccess: boolean;
    error: unknown;
  };
  label: string;
  pendingLabel: string;
  done: ReactNode;
}) {
  const { t } = useI18n();
  const token = useSearchParams().get('token');
  if (!token) {
    return <p className="text-sm text-destructive">{t.emailLinks.incomplete}</p>;
  }
  if (action.isSuccess) {
    return (
      <div role="status" className="flex flex-col items-center gap-3 text-center">
        <CheckCircle2Icon className="size-8 text-success" aria-hidden="true" />
        {done}
      </div>
    );
  }
  return (
    <div className="grid gap-4">
      {action.isError && (
        <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {userMessage(action.error, t)}
        </p>
      )}
      <Button
        size="lg"
        disabled={action.isPending}
        onClick={() => {
          action.mutate(token);
        }}
      >
        {action.isPending ? pendingLabel : label}
      </Button>
    </div>
  );
}

export function ConfirmNewsletterPanel() {
  const { t } = useI18n();
  const copy = t.emailLinks;
  const confirm = useConfirmNewsletter();
  return (
    <EmailLinkAction
      action={confirm}
      label={copy.confirm}
      pendingLabel={copy.confirming}
      done={
        <>
          <p className="font-medium">{copy.subscribed}</p>
          <Button asChild>
            <Link href="/shop">{copy.browse}</Link>
          </Button>
        </>
      }
    />
  );
}

export function UnsubscribePanel() {
  const { t } = useI18n();
  const copy = t.emailLinks;
  const unsubscribe = useUnsubscribe();
  const what =
    unsubscribe.data?.scope === 'order-updates' ? copy.noOrderUpdates : copy.noNewsletter;
  return (
    <EmailLinkAction
      action={unsubscribe}
      label={copy.unsubscribe}
      pendingLabel={copy.unsubscribing}
      done={
        <>
          <p className="font-medium">{copy.unsubscribed}</p>
          <p className="text-sm text-muted-foreground">{what}</p>
          <Button asChild variant="outline">
            <Link href="/account">{copy.manage}</Link>
          </Button>
        </>
      }
    />
  );
}
