'use client';

import { TagIcon, XIcon } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useApplyCoupon, useRemoveCoupon } from '@/lib/api/cart';
import { userMessage } from '@/lib/api/errors';

/** Sends only the code; whether it applies and how much it takes off is decided by cart-service. */
export function CouponForm({ couponCode }: { couponCode: string | null }) {
  const [code, setCode] = useState('');
  const apply = useApplyCoupon();
  const remove = useRemoveCoupon();

  if (couponCode) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-xl bg-secondary px-3 py-2 text-sm">
        <span className="flex items-center gap-2 font-mono">
          <TagIcon className="size-4 text-brand" aria-hidden="true" /> {couponCode}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          aria-label={`Remove code ${couponCode}`}
          disabled={remove.isPending}
          onClick={() => {
            remove.mutate(undefined);
          }}
        >
          <XIcon />
        </Button>
      </div>
    );
  }

  return (
    <form
      className="grid gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (code.trim())
          apply.mutate(code.trim(), {
            onSuccess: () => {
              setCode('');
            },
          });
      }}
    >
      <label htmlFor="coupon" className="text-sm font-medium">
        Discount code
      </label>
      <div className="flex gap-2">
        <Input
          id="coupon"
          value={code}
          onChange={(event) => {
            setCode(event.target.value);
            apply.reset();
          }}
          autoComplete="off"
          spellCheck={false}
          maxLength={40}
          className="font-mono uppercase"
          aria-invalid={apply.isError}
          aria-describedby={apply.isError ? 'coupon-error' : undefined}
        />
        <Button type="submit" variant="outline" disabled={apply.isPending || !code.trim()}>
          Apply
        </Button>
      </div>
      {apply.isError && (
        <p id="coupon-error" role="alert" className="text-sm text-destructive">
          {userMessage(apply.error)}
        </p>
      )}
    </form>
  );
}
