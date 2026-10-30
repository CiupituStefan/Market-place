'use client';

import type { Money } from '@market/types';
import { useI18n } from '@/components/i18n/provider';
import { discountPercent } from '@/lib/format';
import { cn } from '@/lib/utils';

interface PriceProps {
  price: Money;
  compareAt?: Money | null;
  /** Prefix "From" when the product has variants at different prices. */
  from?: boolean;
  size?: 'sm' | 'lg';
  className?: string;
}

export function Price({ price, compareAt, from = false, size = 'sm', className }: PriceProps) {
  const { t, money } = useI18n();
  const discount = discountPercent(price, compareAt);
  return (
    <div className={cn('flex flex-wrap items-baseline gap-x-2 gap-y-1', className)}>
      <span
        className={cn(
          'font-semibold tabular-nums',
          size === 'lg' ? 'text-4xl tracking-tight' : 'text-lg',
        )}
      >
        {from && (
          <span className="mr-1 text-sm font-normal text-muted-foreground">{t.product.from}</span>
        )}
        {money(price)}
      </span>
      {discount !== null && compareAt && (
        <>
          <s
            className={cn(
              'text-muted-foreground tabular-nums',
              size === 'lg' ? 'text-lg' : 'text-sm',
            )}
          >
            <span className="sr-only">{t.product.originalPrice} </span>
            {money(compareAt)}
          </s>
          <span className="bg-brand-soft px-2 py-0.5 text-sm font-semibold text-foreground">
            −{discount}%
          </span>
        </>
      )}
    </div>
  );
}
