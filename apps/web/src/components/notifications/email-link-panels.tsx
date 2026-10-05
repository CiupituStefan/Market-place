'use client';

import { CheckCircle2Icon } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { ReactNode } from 'react';
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
  const token = useSearchParams().get('token');
  if (!token) {
    return (
      <p className="text-sm text-destructive">
        This link is incomplete. Open the link from your email again.
      </p>
    );
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
          {userMessage(action.error)}
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
  const confirm = useConfirmNewsletter();
  return (
    <EmailLinkAction
      action={confirm}
      label="Confirm my subscription"
      pendingLabel="Confirming…"
      done={
        <>
          <p className="font-medium">You are subscribed. Welcome aboard!</p>
          <Button asChild>
            <Link href="/shop">Browse keyboards</Link>
          </Button>
        </>
      }
    />
  );
}

export function UnsubscribePanel() {
  const unsubscribe = useUnsubscribe();
  const what =
    unsubscribe.data?.scope === 'order-updates'
      ? 'You will no longer get shipping and delivery emails. Order confirmations and receipts are still sent.'
      : 'You will no longer receive the newsletter.';
  return (
    <EmailLinkAction
      action={unsubscribe}
      label="Unsubscribe"
      pendingLabel="Unsubscribing…"
      done={
        <>
          <p className="font-medium">You are unsubscribed.</p>
          <p className="text-sm text-muted-foreground">{what}</p>
          <Button asChild variant="outline">
            <Link href="/account">Manage email preferences</Link>
          </Button>
        </>
      }
    />
  );
}
