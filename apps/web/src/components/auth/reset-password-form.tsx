'use client';

import { useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState, type SubmitEvent } from 'react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api/browser';
import { userMessage } from '@/lib/api/errors';
import { fieldErrors, PASSWORD_MAX, PASSWORD_MIN, type FieldErrors } from '@/lib/auth/validation';
import { FormField } from './form-field';

const ResetSchema = z
  .object({
    password: z
      .string()
      .min(PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters.`)
      .max(PASSWORD_MAX, `Use at most ${PASSWORD_MAX} characters.`),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match.',
  });

export function ResetPasswordForm() {
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
    return (
      <p className="text-sm text-destructive">
        This link is incomplete. Request a new reset email.
      </p>
    );
  }
  if (reset.isSuccess) {
    return (
      <div role="status" className="grid gap-4 text-center">
        <p className="font-medium">Password updated. You have been signed out on all devices.</p>
        <Button asChild>
          <Link href="/login">Sign in</Link>
        </Button>
      </div>
    );
  }

  function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const parsed = ResetSchema.safeParse({
      password: data.get('password'),
      confirmPassword: data.get('confirmPassword'),
    });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    reset.mutate(parsed.data.password);
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5">
      <FormField
        label="New password"
        name="password"
        type="password"
        autoComplete="new-password"
        error={errors.password}
      />
      <FormField
        label="Confirm new password"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        error={errors.confirmPassword}
      />
      {reset.isError && (
        <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {userMessage(reset.error)}{' '}
          <Link href="/forgot-password" className="underline">
            Request a new link
          </Link>
        </p>
      )}
      <Button type="submit" size="lg" disabled={reset.isPending}>
        {reset.isPending ? 'Saving…' : 'Set new password'}
      </Button>
    </form>
  );
}
