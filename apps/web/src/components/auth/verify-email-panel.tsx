'use client';

import { useMutation } from '@tanstack/react-query';
import { CheckCircle2Icon } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api/browser';
import { userMessage } from '@/lib/api/errors';

/**
 * Confirmation needs a click: email security scanners open links automatically,
 * and a GET that consumed the token would verify on the scanner's behalf.
 */
export function VerifyEmailPanel() {
  const token = useSearchParams().get('token');
  const verify = useMutation({
    mutationFn: (value: string) =>
      api('/auth/verify-email', { method: 'POST', body: { token: value }, schema: z.unknown() }),
  });

  if (!token) {
    return (
      <p className="text-sm text-destructive">
        This link is incomplete. Open the link from your email again.
      </p>
    );
  }
  if (verify.isSuccess) {
    return (
      <div role="status" className="flex flex-col items-center gap-3 text-center">
        <CheckCircle2Icon className="size-8 text-success" aria-hidden="true" />
        <p className="font-medium">Your email is confirmed.</p>
        <Button asChild>
          <Link href="/account">Go to your account</Link>
        </Button>
      </div>
    );
  }
  return (
    <div className="grid gap-4">
      {verify.isError && (
        <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {userMessage(verify.error)}
        </p>
      )}
      <Button
        size="lg"
        disabled={verify.isPending}
        onClick={() => {
          verify.mutate(token);
        }}
      >
        {verify.isPending ? 'Confirming…' : 'Confirm my email'}
      </Button>
    </div>
  );
}
