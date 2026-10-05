'use client';

import { CheckoutRequestSchema, ErrorCode } from '@market/types';
import { CloudOffIcon, CreditCardIcon, LockIcon, ShoppingBagIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useId, useState, type SubmitEvent } from 'react';
import { FormField } from '@/components/auth/form-field';
import { AddressFields, readAddress } from '@/components/checkout/address-fields';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useCart } from '@/lib/api/cart';
import { ApiError, userMessage } from '@/lib/api/errors';
import { usePlaceOrder } from '@/lib/api/orders';
import { useSession } from '@/lib/api/session';
import { fieldErrors, type FieldErrors } from '@/lib/auth/validation';
import { OrderSummary } from './order-summary';

/**
 * Checkout: contact and addresses, then the order is created server-side from the
 * cart (prices recomputed there; `expectedTotal` only detects a change since the
 * shopper looked). Card details are collected by Stripe's Payment Element on the
 * order page — they never touch our servers, and payment status is confirmed only
 * by Stripe's webhook.
 */
export function CheckoutView() {
  const cart = useCart();
  const session = useSession();

  if (cart.isPending || session.isPending) {
    return <Skeleton className="h-96" aria-label="Loading checkout" />;
  }
  if (cart.isError) {
    return (
      <EmptyState
        icon={CloudOffIcon}
        title="Checkout is unavailable right now"
        description={userMessage(cart.error)}
        action={
          <Button variant="outline" onClick={() => void cart.refetch()}>
            Try again
          </Button>
        }
      />
    );
  }
  if (cart.data.items.length === 0) {
    return (
      <EmptyState
        icon={ShoppingBagIcon}
        title="Nothing to check out yet"
        action={
          <Button asChild>
            <Link href="/shop">Continue shopping</Link>
          </Button>
        }
      />
    );
  }
  if (!cart.data.canCheckout) {
    return (
      <EmptyState
        icon={ShoppingBagIcon}
        title="Some items in your cart need attention"
        description="An item is out of stock or no longer available. Review your cart to continue."
        action={
          <Button asChild>
            <Link href="/cart">Review cart</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_22rem]">
      <CheckoutForm
        expectedTotal={cart.data.total.amount}
        email={session.data?.email ?? ''}
        signedIn={Boolean(session.data)}
      />
      <OrderSummary cart={cart.data} />
    </div>
  );
}

function CheckoutForm({
  expectedTotal,
  email,
  signedIn,
}: {
  expectedTotal: number;
  email: string;
  signedIn: boolean;
}) {
  const router = useRouter();
  const billingId = useId();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [billingSame, setBillingSame] = useState(true);
  // One key per checkout attempt: double clicks and retries cannot create two orders.
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const place = usePlaceOrder();

  function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const notes = data.get('notes');
    const parsed = CheckoutRequestSchema.safeParse({
      email: data.get('email'),
      shippingAddress: readAddress(data, 'shippingAddress'),
      billingAddress: billingSame ? null : readAddress(data, 'billingAddress'),
      expectedTotal,
      notes: typeof notes === 'string' && notes.trim() ? notes.trim() : null,
    });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    place.mutate(
      { input: parsed.data, idempotencyKey },
      {
        onSuccess: (order) => {
          router.push(`/order/${order.id}`);
        },
      },
    );
  }

  const priceChanged =
    place.error instanceof ApiError && place.error.code === ErrorCode.PRICE_CHANGED;

  return (
    <form
      onSubmit={onSubmit}
      onInput={(event) => {
        // A field stops showing its error as soon as the shopper edits it.
        const { name } = event.target as HTMLInputElement;
        if (name in errors) {
          setErrors(({ [name]: _fixed, ...rest }) => rest);
        }
      }}
      noValidate
      className="grid gap-8"
      aria-busy={place.isPending}
    >
      <section className="grid gap-4 rounded-2xl border p-6">
        <h2 className="flex items-center gap-3 font-semibold">
          <Step n={1} /> Contact
        </h2>
        <FormField
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={email}
          required
          hint="For your order confirmation and shipping updates"
          error={errors.email}
        />
        {!signedIn && (
          <p className="text-sm text-muted-foreground">
            Have an account?{' '}
            <Link href="/login?next=%2Fcheckout" prefetch={false} className="underline">
              Sign in
            </Link>{' '}
            to see this order in your account.
          </p>
        )}
      </section>

      <section className="grid gap-4 rounded-2xl border p-6">
        <h2 className="flex items-center gap-3 font-semibold">
          <Step n={2} /> Shipping address
        </h2>
        <AddressFields prefix="shippingAddress" errors={errors} />
        <div className="flex items-center gap-2">
          <Checkbox
            id={billingId}
            checked={billingSame}
            onCheckedChange={(checked) => {
              setBillingSame(checked === true);
            }}
          />
          <Label htmlFor={billingId}>Billing address is the same</Label>
        </div>
        {!billingSame && (
          <div className="grid gap-4 border-t pt-4">
            <h3 className="text-sm font-semibold">Billing address</h3>
            <AddressFields prefix="billingAddress" errors={errors} />
          </div>
        )}
        <div className="grid gap-2">
          <Label htmlFor="notes">Order notes (optional)</Label>
          <textarea
            id="notes"
            name="notes"
            maxLength={500}
            rows={2}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
          />
        </div>
      </section>

      <section className="grid gap-4 rounded-2xl border p-6">
        <h2 className="flex items-center gap-3 font-semibold">
          <Step n={3} /> Payment
        </h2>
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <CreditCardIcon className="size-4" aria-hidden="true" /> After you place the order, you
          pay securely with Stripe. Your items are held for 30 minutes.
        </p>
        {place.isError && (
          <p role="alert" className="text-sm text-destructive">
            {priceChanged
              ? 'Your order total changed since you opened checkout. Review the updated summary and place your order again.'
              : userMessage(place.error)}
          </p>
        )}
        <Button type="submit" size="lg" disabled={place.isPending}>
          <LockIcon /> {place.isPending ? 'Placing order…' : 'Place order'}
        </Button>
      </section>
    </form>
  );
}

function Step({ n }: { n: number }) {
  return (
    <span className="flex size-7 items-center justify-center rounded-full bg-secondary font-mono text-xs">
      {n}
    </span>
  );
}
