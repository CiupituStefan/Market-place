import type { Money } from '@market/types';
import { discountPercent, formatMoney } from '@/lib/format';
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
  const discount = discountPercent(price, compareAt);
  return (
    <div className={cn('flex flex-wrap items-baseline gap-x-2 gap-y-1', className)}>
      <span
        className={cn(
          'font-semibold tabular-nums',
          size === 'lg' ? 'text-3xl tracking-tight' : 'text-base',
        )}
      >
        {from && <span className="mr-1 text-xs font-normal text-muted-foreground">From</span>}
        {formatMoney(price)}
      </span>
      {discount !== null && compareAt && (
        <>
          <s
            className={cn(
              'text-muted-foreground tabular-nums',
              size === 'lg' ? 'text-lg' : 'text-sm',
            )}
          >
            <span className="sr-only">Original price </span>
            {formatMoney(compareAt)}
          </s>
          <span className="rounded-full bg-brand-soft px-2 py-0.5 font-mono text-[0.68rem] font-semibold text-foreground">
            −{discount}%
          </span>
        </>
      )}
    </div>
  );
}
