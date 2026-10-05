'use client';

import { useMutation } from '@tanstack/react-query';
import { useState, type SubmitEvent } from 'react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api/browser';
import { userMessage } from '@/lib/api/errors';
import { FormField } from './form-field';

export function ForgotPasswordForm() {
  const [error, setError] = useState<string>();
  const request = useMutation({
    mutationFn: (email: string) =>
      api('/auth/forgot-password', { method: 'POST', body: { email }, schema: z.unknown() }),
  });

  function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = z.email().safeParse(new FormData(event.currentTarget).get('email'));
    if (!parsed.success) {
      setError('Enter a valid email address.');
      return;
    }
    setError(undefined);
    request.mutate(parsed.data);
  }

  if (request.isSuccess) {
    // Same message whether or not the account exists (no account enumeration).
    return (
      <p role="status" className="text-sm">
        If an account exists for that email, a reset link is on its way.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5">
      <FormField
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        required
        error={error}
      />
      {request.isError && (
        <p role="alert" className="text-sm text-destructive">
          {userMessage(request.error)}
        </p>
      )}
      <Button type="submit" size="lg" disabled={request.isPending}>
        {request.isPending ? 'Sending…' : 'Send reset link'}
      </Button>
    </form>
  );
}
