'use client';

import { useMutation } from '@tanstack/react-query';
import { useId, useState, type SubmitEvent } from 'react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api/browser';
import { userMessage } from '@/lib/api/errors';

const EmailSchema = z.email('Enter a valid email address.');

export function NewsletterForm() {
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
    const parsed = EmailSchema.safeParse(email.trim());
    if (!parsed.success) {
      setValidationError(parsed.error.issues[0]?.message ?? 'Invalid email');
      return;
    }
    setValidationError(null);
    subscribe.mutate(parsed.data);
  }

  if (subscribe.isSuccess) {
    return (
      <p role="status" className="text-sm font-medium">
        Thanks! Check your inbox to confirm your subscription.
      </p>
    );
  }

  const error = validationError ?? (subscribe.isError ? userMessage(subscribe.error) : null);
  const errorId = `${inputId}-error`;

  return (
    <form onSubmit={onSubmit} noValidate className="w-full max-w-md">
      <div className="flex gap-2">
        <label htmlFor={inputId} className="sr-only">
          Email address
        </label>
        <Input
          id={inputId}
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="h-11 bg-background"
        />
        <Button type="submit" size="lg" className="h-11" disabled={subscribe.isPending}>
          {subscribe.isPending ? 'Joining…' : 'Subscribe'}
        </Button>
      </div>
      {error && (
        <p id={errorId} role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <p className="mt-3 text-xs text-muted-foreground">One email a month. Unsubscribe anytime.</p>
    </form>
  );
}
