'use client';

import type { Order, PaymentSession } from '@market/types';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe, type Stripe } from '@stripe/stripe-js';
import { FlaskConicalIcon, LoaderIcon, LockIcon } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useState, type SubmitEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { userMessage } from '@/lib/api/errors';
import { useMockConfirm, usePaymentSession } from '@/lib/api/payments';
import { formatMoney } from '@/lib/format';

const stripePromises = new Map<string, Promise<Stripe | null>>();

/** Stripe.js is loaded once per key, only on pages that take payment. */
function stripeFor(publishableKey: string): Promise<Stripe | null> {
  let promise = stripePromises.get(publishableKey);
  if (!promise) {
    promise = loadStripe(publishableKey);
    stripePromises.set(publishableKey, promise);
  }
  return promise;
}

/**
 * Takes payment for an unpaid order. Card details are typed into Stripe's
 * Payment Element (an iframe served by Stripe) and never reach our servers.
 * Success here only means "submitted": the order becomes PAID when Stripe's
 * webhook says so, which the order page picks up by polling.
 */
export function PaymentPanel({ order, onSubmitted }: { order: Order; onSubmitted: () => void }) {
  const session = usePaymentSession(order.id, true);

  if (session.isPending) return <Skeleton className="h-48" aria-label="Loading payment form" />;
  if (session.isError) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {userMessage(session.error)}
      </p>
    );
  }
  return session.data.provider === 'mock' ? (
    <MockPaymentForm session={session.data} onSubmitted={onSubmitted} />
  ) : (
    <StripePaymentForm session={session.data} onSubmitted={onSubmitted} />
  );
}

function StripePaymentForm({
  session,
  onSubmitted,
}: {
  session: PaymentSession;
  onSubmitted: () => void;
}) {
  const { resolvedTheme } = useTheme();
  return (
    <Elements
      stripe={stripeFor(session.publishableKey)}
      options={{
        clientSecret: session.clientSecret,
        appearance: {
          theme: resolvedTheme === 'dark' ? 'night' : 'stripe',
          variables: { borderRadius: '10px', fontFamily: 'inherit' },
        },
      }}
    >
      <StripeForm session={session} onSubmitted={onSubmitted} />
    </Elements>
  );
}

function StripeForm({
  session,
  onSubmitted,
}: {
  session: PaymentSession;
  onSubmitted: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError(null);
    const result = await stripe.confirmPayment({
      elements,
      // Methods that need a redirect (3-D Secure, bank pages) come back to this page.
      confirmParams: { return_url: window.location.href },
      redirect: 'if_required',
    });
    setSubmitting(false);
    if (result.error) {
      setError(result.error.message ?? 'Your payment could not be completed.');
      return;
    }
    onSubmitted();
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="grid gap-4">
      <PaymentElement options={{ layout: 'tabs' }} />
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" disabled={!stripe || submitting}>
        <LockIcon /> {submitting ? 'Processing…' : `Pay ${formatMoney(session.amount)}`}
      </Button>
    </form>
  );
}

/** Development stand-in for the Payment Element (PAYMENT_PROVIDER=mock only). */
function MockPaymentForm({
  session,
  onSubmitted,
}: {
  session: PaymentSession;
  onSubmitted: () => void;
}) {
  const confirm = useMockConfirm();
  const [declined, setDeclined] = useState(false);
  return (
    <div className="grid gap-4">
      <p className="flex items-center gap-2 rounded-xl border border-dashed p-3 text-sm text-muted-foreground">
        <FlaskConicalIcon className="size-4 shrink-0" aria-hidden="true" />
        Test mode: no real payment is taken. Stripe’s card form appears here when Stripe keys are
        configured.
      </p>
      {declined && (
        <p role="alert" className="text-sm text-destructive">
          Your card was declined. Try again.
        </p>
      )}
      {confirm.isError && (
        <p role="alert" className="text-sm text-destructive">
          {userMessage(confirm.error)}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Button
          size="lg"
          className="flex-1"
          disabled={confirm.isPending}
          onClick={() => {
            setDeclined(false);
            confirm.mutate(
              { clientSecret: session.clientSecret, outcome: 'succeed' },
              { onSuccess: onSubmitted },
            );
          }}
        >
          {confirm.isPending ? <LoaderIcon className="animate-spin" /> : <LockIcon />} Pay{' '}
          {formatMoney(session.amount)} (test)
        </Button>
        <Button
          size="lg"
          variant="outline"
          disabled={confirm.isPending}
          onClick={() => {
            confirm.mutate(
              { clientSecret: session.clientSecret, outcome: 'fail' },
              {
                onSuccess: () => {
                  setDeclined(true);
                },
              },
            );
          }}
        >
          Simulate decline
        </Button>
      </div>
    </div>
  );
}
