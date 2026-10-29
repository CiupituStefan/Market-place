'use client';

import { useI18n } from '@/components/i18n/provider';
import { useMutation } from '@tanstack/react-query';
import { CheckCircle2Icon } from 'lucide-react';
import Link from '@/components/i18n/link';
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
  const { t } = useI18n();
  const token = useSearchParams().get('token');
  const verify = useMutation({
    mutationFn: (value: string) =>
      api('/auth/verify-email', { method: 'POST', body: { token: value }, schema: z.unknown() }),
  });

  if (!token) {
    return <p className="text-sm text-destructive">{t.auth.incompleteVerify}</p>;
  }
  if (verify.isSuccess) {
    return (
      <div role="status" className="flex flex-col items-center gap-3 text-center">
        <CheckCircle2Icon className="size-8 text-success" aria-hidden="true" />
        <p className="font-medium">{t.auth.emailConfirmed}</p>
        <Button asChild>
          <Link href="/account">{t.auth.goToAccount}</Link>
        </Button>
      </div>
    );
  }
  return (
    <div className="grid gap-4">
      {verify.isError && (
        <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {userMessage(verify.error, t)}
        </p>
      )}
      <Button
        size="lg"
        disabled={verify.isPending}
        onClick={() => {
          verify.mutate(token);
        }}
      >
        {verify.isPending ? t.auth.confirming : t.auth.confirmEmail}
      </Button>
    </div>
  );
}
