'use client';

import { useI18n } from '@/components/i18n/provider';
import { useMutation } from '@tanstack/react-query';
import Link from '@/components/i18n/link';
import { useSearchParams } from 'next/navigation';
import { useState, type SubmitEvent } from 'react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api/browser';
import { userMessage } from '@/lib/api/errors';
import type { Messages } from '@/lib/i18n/messages';
import { fieldErrors, PASSWORD_MAX, PASSWORD_MIN, type FieldErrors } from '@/lib/auth/validation';
import { FormField } from './form-field';

const resetSchema = (t: Messages) =>
  z
    .object({
      password: z
        .string()
        .min(PASSWORD_MIN, t.auth.useAtLeast(PASSWORD_MIN))
        .max(PASSWORD_MAX, t.auth.useAtMost(PASSWORD_MAX)),
      confirmPassword: z.string(),
    })
    .refine((d) => d.password === d.confirmPassword, {
      path: ['confirmPassword'],
      message: t.auth.passwordsDiffer,
    });

export function ResetPasswordForm() {
  const { t } = useI18n();
  const token = useSearchParams().get('token');
  const [errors, setErrors] = useState<FieldErrors>({});
  const reset = useMutation({
    mutationFn: (password: string) =>
      api('/auth/reset-password', {
        method: 'POST',
        body: { token, password },
        schema: z.unknown(),
      }),
  });

  if (!token) {
    return <p className="text-sm text-destructive">{t.auth.incompleteReset}</p>;
  }
  if (reset.isSuccess) {
    return (
      <div role="status" className="grid gap-4 text-center">
        <p className="font-medium">{t.auth.passwordUpdated}</p>
        <Button asChild>
          <Link href="/login">{t.auth.signIn}</Link>
        </Button>
      </div>
    );
  }

  function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const parsed = resetSchema(t).safeParse({
      password: data.get('password'),
      confirmPassword: data.get('confirmPassword'),
    });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error, t));
      return;
    }
    setErrors({});
    reset.mutate(parsed.data.password);
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5">
      <FormField
        label={t.auth.newPassword}
        name="password"
        type="password"
        autoComplete="new-password"
        error={errors.password}
      />
      <FormField
        label={t.auth.confirmNewPassword}
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        error={errors.confirmPassword}
      />
      {reset.isError && (
        <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {userMessage(reset.error, t)}{' '}
          <Link href="/forgot-password" className="underline">
            {t.auth.requestNewLink}
          </Link>
        </p>
      )}
      <Button type="submit" size="lg" disabled={reset.isPending}>
        {reset.isPending ? t.common.saving : t.auth.setNewPassword}
      </Button>
    </form>
  );
}
