'use client';

import { useI18n } from '@/components/i18n/provider';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from '@/components/i18n/link';
import { useSearchParams } from 'next/navigation';
import { useState, type SubmitEvent } from 'react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api/browser';
import { ApiError, userMessage } from '@/lib/api/errors';
import { fieldErrors, LoginSchema, safeRedirect, type FieldErrors } from '@/lib/auth/validation';
import { FormField } from './form-field';

/** With two-step sign-in on, the password returns a challenge instead of a session. */
const LoginResponseSchema = z.union([
  z.object({ mfaRequired: z.literal(true), challenge: z.string() }),
  z.object({ user: z.unknown() }),
]);

export function LoginForm() {
  const { t, path } = useI18n();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [challenge, setChallenge] = useState<string | null>(null);

  const signedIn = () => {
    queryClient.clear();
    // Full navigation: the identity changed, so no client-cached route (e.g. a
    // redirect-to-login prefetched while anonymous) may be reused.
    window.location.assign(safeRedirect(searchParams.get('next'), path('/account')));
  };

  const login = useMutation({
    mutationFn: (input: z.infer<typeof LoginSchema>) =>
      api('/auth/login', { method: 'POST', body: input, schema: LoginResponseSchema }),
    onSuccess: (result) => {
      if ('mfaRequired' in result) setChallenge(result.challenge);
      else signedIn();
    },
  });

  if (challenge) {
    return (
      <MfaStep
        challenge={challenge}
        onDone={signedIn}
        onRestart={() => {
          setChallenge(null);
          login.reset();
        }}
      />
    );
  }

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

/** Second step: an authenticator or recovery code redeems the challenge. */
function MfaStep({
  challenge,
  onDone,
  onRestart,
}: {
  challenge: string;
  onDone: () => void;
  onRestart: () => void;
}) {
  const { t } = useI18n();
  const verify = useMutation({
    mutationFn: (code: string) =>
      api('/auth/login/mfa', { method: 'POST', body: { challenge, code }, schema: z.unknown() }),
    onSuccess: onDone,
  });
  const expired = verify.error instanceof ApiError && verify.error.code === 'INVALID_TOKEN';

  function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = new FormData(event.currentTarget).get('code');
    const code = typeof value === 'string' ? value.trim() : '';
    if (code) verify.mutate(code);
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5">
      <div>
        <h2 className="text-lg font-semibold">{t.auth.mfaTitle}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t.auth.mfaPrompt}</p>
      </div>
      <FormField
        label={t.auth.mfaCode}
        name="code"
        autoComplete="one-time-code"
        inputMode="text"
        autoFocus
        required
      />
      {verify.isError && (
        <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {expired ? t.auth.mfaExpired : userMessage(verify.error, t)}
        </p>
      )}
      <Button type="submit" size="lg" disabled={verify.isPending || expired}>
        {verify.isPending ? t.auth.mfaVerifying : t.auth.mfaVerify}
      </Button>
      <button
        type="button"
        onClick={onRestart}
        className="text-sm text-muted-foreground underline-offset-4 hover:underline"
      >
        {t.auth.mfaStartOver}
      </button>
    </form>
  );
}
