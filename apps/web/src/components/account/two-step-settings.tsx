'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import QRCode from 'qrcode';
import { useEffect, useState, type SubmitEvent } from 'react';
import { z } from 'zod';
import { FormField } from '@/components/auth/form-field';
import { useI18n } from '@/components/i18n/provider';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api/browser';
import { userMessage } from '@/lib/api/errors';

const StatusSchema = z.object({
  enabled: z.boolean(),
  recoveryCodesLeft: z.number(),
  sessionVerified: z.boolean(),
});
const SetupSchema = z.object({ secret: z.string(), otpauthUri: z.string() });
const EnabledSchema = z.object({ recoveryCodes: z.array(z.string()) });

/** A text field's value, trimmed ('' when absent). */
function text(data: FormData, name: string): string {
  const value = data.get(name);
  return typeof value === 'string' ? value.trim() : '';
}

type Step =
  | { kind: 'idle' }
  | { kind: 'password' }
  | { kind: 'scan'; secret: string; qr: string }
  | { kind: 'codes'; codes: string[] }
  | { kind: 'disable' };

/**
 * Two-step sign-in (TOTP) for the account: required for staff, optional for customers.
 * Turning it on or off signs every device out; the page then sends the user to sign in again.
 */
export function TwoStepSettings({ required }: { required: boolean }) {
  const { t, path } = useI18n();
  const copy = t.account.security;
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>({ kind: 'idle' });
  const status = useQuery({
    queryKey: ['mfa-status'],
    queryFn: () => api('/auth/mfa', { schema: StatusSchema }),
  });

  const signInAgain = () => {
    queryClient.clear();
    window.location.assign(`${path('/login')}?next=${encodeURIComponent(path('/account'))}`);
  };

  const setup = useMutation({
    mutationFn: (password: string) =>
      api('/auth/mfa/setup', { method: 'POST', body: { password }, schema: SetupSchema }),
    onSuccess: async ({ secret, otpauthUri }) => {
      // Drawn here: the secret never leaves the browser for a QR service.
      const qr = await QRCode.toDataURL(otpauthUri, { margin: 1, width: 200 });
      setStep({ kind: 'scan', secret, qr });
    },
  });
  const enable = useMutation({
    mutationFn: (code: string) =>
      api('/auth/mfa/enable', { method: 'POST', body: { code }, schema: EnabledSchema }),
    onSuccess: ({ recoveryCodes }) => {
      setStep({ kind: 'codes', codes: recoveryCodes });
    },
  });
  const disable = useMutation({
    mutationFn: (input: { password: string; code: string }) =>
      api('/auth/mfa/disable', { method: 'POST', body: input, schema: z.unknown() }),
    onSuccess: signInAgain,
  });

  // A link to /account#security (from the back office) scrolls here once loaded.
  useEffect(() => {
    if (status.isSuccess && window.location.hash === '#security') {
      document.getElementById('security')?.scrollIntoView();
    }
  }, [status.isSuccess]);

  const field = (event: SubmitEvent<HTMLFormElement>, name: string) => {
    event.preventDefault();
    return text(new FormData(event.currentTarget), name);
  };
  const failure = setup.error ?? enable.error ?? disable.error;

  if (status.isPending) return <Skeleton className="h-28" aria-label={copy.loading} />;
  if (status.isError) {
    return <p className="text-sm text-destructive">{userMessage(status.error, t)}</p>;
  }

  return (
    <section
      id="security"
      aria-labelledby="security-title"
      className="grid scroll-mt-28 gap-5 rounded-2xl border p-6"
    >
      <div>
        <h2 id="security-title" className="font-semibold">
          {copy.title}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {status.data.enabled ? copy.on(status.data.recoveryCodesLeft) : copy.off}
        </p>
        {required && !status.data.enabled && (
          <p className="mt-2 text-sm font-medium text-destructive">{copy.required}</p>
        )}
      </div>

      {step.kind === 'idle' &&
        (status.data.enabled ? (
          <Button
            variant="outline"
            className="justify-self-start"
            onClick={() => {
              setStep({ kind: 'disable' });
            }}
          >
            {copy.turnOff}
          </Button>
        ) : (
          <Button
            className="justify-self-start"
            onClick={() => {
              setStep({ kind: 'password' });
            }}
          >
            {copy.turnOn}
          </Button>
        ))}

      {step.kind === 'password' && (
        <form
          className="grid max-w-sm gap-4"
          onSubmit={(event) => {
            const password = field(event, 'password');
            if (password) setup.mutate(password);
          }}
        >
          <FormField
            label={copy.confirmPassword}
            name="password"
            type="password"
            autoComplete="current-password"
            required
            autoFocus
          />
          <div className="flex gap-3">
            <Button type="submit" disabled={setup.isPending}>
              {setup.isPending ? copy.working : copy.continue}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setStep({ kind: 'idle' });
              }}
            >
              {copy.cancel}
            </Button>
          </div>
        </form>
      )}

      {step.kind === 'scan' && (
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            const code = field(event, 'code');
            if (code) enable.mutate(code);
          }}
        >
          <p className="text-sm">{copy.scan}</p>
          {/* eslint-disable-next-line @next/next/no-img-element -- a data: URL drawn in the browser */}
          <img
            src={step.qr}
            alt={copy.qr}
            width={200}
            height={200}
            className="rounded-lg bg-white p-1"
          />
          <p className="text-sm">
            {copy.key}:{' '}
            <code className="rounded bg-muted px-2 py-1 font-mono text-sm break-all select-all">
              {step.secret.match(/.{1,4}/g)?.join(' ')}
            </code>
          </p>
          <p className="text-sm text-muted-foreground">{copy.enterCode}</p>
          <div className="grid max-w-sm gap-4">
            <FormField
              label={copy.code}
              name="code"
              autoComplete="one-time-code"
              inputMode="numeric"
              required
            />
            <div className="flex gap-3">
              <Button type="submit" disabled={enable.isPending}>
                {enable.isPending ? copy.working : copy.confirm}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setStep({ kind: 'idle' });
                }}
              >
                {copy.cancel}
              </Button>
            </div>
          </div>
        </form>
      )}

      {step.kind === 'codes' && (
        <div className="grid gap-4">
          <div>
            <h3 className="font-semibold">{copy.codesTitle}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{copy.codesBody}</p>
          </div>
          <ol className="grid max-w-md grid-cols-2 gap-2 rounded-lg bg-muted p-4 font-mono text-sm select-all">
            {step.codes.map((code) => (
              <li key={code}>{code}</li>
            ))}
          </ol>
          <p className="text-sm">{copy.signedOut}</p>
          <Button className="justify-self-start" onClick={signInAgain}>
            {copy.codesSaved}
          </Button>
        </div>
      )}

      {step.kind === 'disable' && (
        <form
          className="grid max-w-sm gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            const password = text(data, 'password');
            const code = text(data, 'code');
            if (password && code) disable.mutate({ password, code });
          }}
        >
          <p className="text-sm text-muted-foreground">{copy.offBody}</p>
          <FormField
            label={copy.confirmPassword}
            name="password"
            type="password"
            autoComplete="current-password"
            required
            autoFocus
          />
          <FormField label={t.auth.mfaCode} name="code" autoComplete="one-time-code" required />
          <div className="flex gap-3">
            <Button type="submit" variant="destructive" disabled={disable.isPending}>
              {disable.isPending ? copy.working : copy.turnOff}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setStep({ kind: 'idle' });
              }}
            >
              {copy.cancel}
            </Button>
          </div>
        </form>
      )}

      {failure && step.kind !== 'idle' && step.kind !== 'codes' && (
        <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {userMessage(failure, t)}
        </p>
      )}
    </section>
  );
}
