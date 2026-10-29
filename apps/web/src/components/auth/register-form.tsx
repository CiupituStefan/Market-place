'use client';

import { useI18n } from '@/components/i18n/provider';
import { useMutation } from '@tanstack/react-query';
import { MailCheckIcon } from 'lucide-react';
import Link from '@/components/i18n/link';
import { useId, useState, type SubmitEvent } from 'react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api/browser';
import { userMessage } from '@/lib/api/errors';
import { fieldErrors, PASSWORD_MIN, RegisterSchema, type FieldErrors } from '@/lib/auth/validation';
import { FormField } from './form-field';

export function RegisterForm() {
  const { t } = useI18n();
  const termsId = useId();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [acceptTerms, setAcceptTerms] = useState(false);

  const register = useMutation({
    mutationFn: ({
      confirmPassword: _c,
      acceptTerms: _a,
      ...input
    }: z.infer<typeof RegisterSchema>) =>
      api('/auth/register', { method: 'POST', body: input, schema: z.unknown() }),
  });

  function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const parsed = RegisterSchema.safeParse({
      firstName: data.get('firstName'),
      lastName: data.get('lastName'),
      email: data.get('email'),
      password: data.get('password'),
      confirmPassword: data.get('confirmPassword'),
      acceptTerms,
    });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error, t));
      return;
    }
    setErrors({});
    register.mutate(parsed.data);
  }

  if (register.isSuccess) {
    return (
      <div role="status" className="flex flex-col items-center gap-3 text-center">
        <MailCheckIcon className="size-8 text-brand" aria-hidden="true" />
        <h2 className="text-lg font-semibold">{t.auth.checkInbox}</h2>
        <p className="text-sm text-muted-foreground">{t.auth.sentVerification}</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField
          label={t.auth.firstName}
          name="firstName"
          autoComplete="given-name"
          required
          error={errors.firstName}
        />
        <FormField
          label={t.auth.lastName}
          name="lastName"
          autoComplete="family-name"
          required
          error={errors.lastName}
        />
      </div>
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
        autoComplete="new-password"
        required
        hint={t.auth.passwordHint(PASSWORD_MIN)}
        error={errors.password}
      />
      <FormField
        label={t.auth.confirmPassword}
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        required
        error={errors.confirmPassword}
      />
      <div className="grid gap-1.5">
        <div className="flex items-start gap-2.5">
          <Checkbox
            id={termsId}
            checked={acceptTerms}
            onCheckedChange={(state) => {
              setAcceptTerms(state === true);
            }}
            aria-invalid={errors.acceptTerms ? true : undefined}
          />
          <Label htmlFor={termsId} className="leading-snug font-normal">
            <span>
              {t.auth.agree}{' '}
              <Link href="/terms" className="underline">
                {t.auth.terms}
              </Link>{' '}
              {t.auth.and}{' '}
              <Link href="/privacy" className="underline">
                {t.auth.privacy}
              </Link>
              .
            </span>
          </Label>
        </div>
        {errors.acceptTerms && <p className="text-xs text-destructive">{errors.acceptTerms}</p>}
      </div>
      {register.isError && (
        <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {userMessage(register.error, t)}
        </p>
      )}
      <Button type="submit" size="lg" disabled={register.isPending}>
        {register.isPending ? t.auth.creating : t.auth.createAccount}
      </Button>
    </form>
  );
}
