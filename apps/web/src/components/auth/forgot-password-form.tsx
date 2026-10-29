'use client';

import { useI18n } from '@/components/i18n/provider';
import { useMutation } from '@tanstack/react-query';
import { useState, type SubmitEvent } from 'react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api/browser';
import { userMessage } from '@/lib/api/errors';
import { FormField } from './form-field';

export function ForgotPasswordForm() {
  const { t } = useI18n();
  const [error, setError] = useState<string>();
  const request = useMutation({
    mutationFn: (email: string) =>
      api('/auth/forgot-password', { method: 'POST', body: { email }, schema: z.unknown() }),
  });

  function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = z.email().safeParse(new FormData(event.currentTarget).get('email'));
    if (!parsed.success) {
      setError(t.auth.invalidEmail);
      return;
    }
    setError(undefined);
    request.mutate(parsed.data);
  }

  if (request.isSuccess) {
    // Same message whether or not the account exists (no account enumeration).
    return (
      <p role="status" className="text-sm">
        {t.auth.resetSent}
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5">
      <FormField
        label={t.auth.email}
        name="email"
        type="email"
        autoComplete="email"
        required
        error={error}
      />
      {request.isError && (
        <p role="alert" className="text-sm text-destructive">
          {userMessage(request.error, t)}
        </p>
      )}
      <Button type="submit" size="lg" disabled={request.isPending}>
        {request.isPending ? t.auth.sending : t.auth.sendReset}
      </Button>
    </form>
  );
}
