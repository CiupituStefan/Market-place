'use client';

import { CloudOffIcon, CreditCardIcon, ShoppingBagIcon } from 'lucide-react';
import Link from 'next/link';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useCart } from '@/lib/api/cart';
import { userMessage } from '@/lib/api/errors';
import { OrderSummary } from './order-summary';

const STEPS = ['Contact', 'Shipping', 'Payment'];

/**
 * Checkout shell. The order is created server-side from the cart (prices are
 * recomputed there), then Stripe's Payment Element collects card details
 * directly — card data never touches our servers. Payment status is confirmed
 * only by the Stripe webhook, never by this page.
 */
export function CheckoutView() {
  const cart = useCart();

  if (cart.isPending) return <Skeleton className="h-96" aria-label="Loading checkout" />;
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
      <ol className="grid gap-4">
        {STEPS.map((step, index) => (
          <li key={step} className="rounded-2xl border p-6">
            <h2 className="flex items-center gap-3 font-semibold">
              <span className="flex size-7 items-center justify-center rounded-full bg-secondary font-mono text-xs">
                {index + 1}
              </span>
              {step}
            </h2>
            {step === 'Payment' && (
              <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                <CreditCardIcon className="size-4" aria-hidden="true" /> Card details are entered in
                Stripe’s secure payment form.
              </p>
            )}
          </li>
        ))}
      </ol>
      <OrderSummary cart={cart.data} />
    </div>
  );
}
