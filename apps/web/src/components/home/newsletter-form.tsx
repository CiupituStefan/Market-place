'use client';

import { useMutation } from '@tanstack/react-query';
import { useId, useState, type SubmitEvent } from 'react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api/browser';
import { useI18n } from '@/components/i18n/provider';
import { userMessage } from '@/lib/api/errors';

export function NewsletterForm() {
  const { t } = useI18n();
  const copy = t.home.newsletter;
  const inputId = useId();
  const [email, setEmail] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const subscribe = useMutation({
    mutationFn: (value: string) =>
      api('/newsletter/subscriptions', {
        method: 'POST',
        body: { email: value },
        schema: z.unknown(),
      }),
  });

  function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = z.email(copy.invalidEmail).safeParse(email.trim());
    if (!parsed.success) {
      setValidationError(parsed.error.issues[0]?.message ?? copy.invalidEmail);
      return;
    }
    setValidationError(null);
    subscribe.mutate(parsed.data);
  }

  if (subscribe.isSuccess) {
    return (
      <p role="status" className="text-sm font-medium">
        {copy.thanks}
      </p>
    );
  }

  const error = validationError ?? (subscribe.isError ? userMessage(subscribe.error, t) : null);
  const errorId = `${inputId}-error`;

  return (
    <form onSubmit={onSubmit} noValidate className="w-full max-w-md">
      <div className="flex gap-2">
        <label htmlFor={inputId} className="sr-only">
          {copy.email}
        </label>
        <Input
          id={inputId}
          type="email"
          autoComplete="email"
          placeholder={copy.placeholder}
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="h-11 bg-background"
        />
        <Button type="submit" size="lg" className="h-11" disabled={subscribe.isPending}>
          {subscribe.isPending ? copy.joining : copy.subscribe}
        </Button>
      </div>
      {error && (
        <p id={errorId} role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <p className="mt-3 text-xs text-muted-foreground">{copy.fineprint}</p>
    </form>
  );
}
