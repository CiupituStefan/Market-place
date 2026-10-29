'use client';

import { useI18n } from '@/components/i18n/provider';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from '@/components/i18n/link';
import { useSearchParams } from 'next/navigation';
import { useState, type SubmitEvent } from 'react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api/browser';
import { userMessage } from '@/lib/api/errors';
import { fieldErrors, LoginSchema, safeRedirect, type FieldErrors } from '@/lib/auth/validation';
import { FormField } from './form-field';

export function LoginForm() {
  const { t, path } = useI18n();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [errors, setErrors] = useState<FieldErrors>({});

  const login = useMutation({
    mutationFn: (input: z.infer<typeof LoginSchema>) =>
      api('/auth/login', { method: 'POST', body: input, schema: z.unknown() }),
    onSuccess: () => {
      queryClient.clear();
      // Full navigation: the identity changed, so no client-cached route (e.g. a
      // redirect-to-login prefetched while anonymous) may be reused.
      window.location.assign(safeRedirect(searchParams.get('next'), path('/account')));
    },
  });

  function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const parsed = LoginSchema.safeParse({
      email: data.get('email'),
      password: data.get('password'),
    });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error, t));
      return;
    }
    setErrors({});
    login.mutate(parsed.data);
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5">
      <FormField
        label={t.auth.email}
        name="email"
        type="email"
        autoComplete="email"
        required
        error={errors.email}
      />
      <FormField
        label={t.auth.password}
        name="password"
        type="password"
        autoComplete="current-password"
        required
        error={errors.password}
      />
      <div className="-mt-2 text-right text-sm">
        <Link
          href="/forgot-password"
          className="text-muted-foreground underline-offset-4 hover:underline"
        >
          {t.auth.forgot}
        </Link>
      </div>
      {login.isError && (
        <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {userMessage(login.error, t)}
        </p>
      )}
      <Button type="submit" size="lg" disabled={login.isPending}>
        {login.isPending ? t.auth.signingIn : t.auth.signIn}
      </Button>
    </form>
  );
}
