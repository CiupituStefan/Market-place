'use client';

import { StarIcon } from 'lucide-react';
import { useI18n } from '@/components/i18n/provider';
import { cn } from '@/lib/utils';

interface RatingProps {
  value: number;
  count?: number;
  className?: string;
  size?: 'sm' | 'md';
}

export function Rating({ value, count, className, size = 'sm' }: RatingProps) {
  const { t, number } = useI18n();
  // No stars at all until there is a review: an empty row of stars reads as a bad score.
  if (count === 0) return null;
  const rounded = Math.round(value * 2) / 2;
  const star = size === 'sm' ? 'size-3.5' : 'size-4.5';
  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <div className="flex" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((i) => (
          <span key={i} className="relative">
            <StarIcon className={cn(star, 'fill-muted text-muted')} />
            {rounded >= i - 0.5 && (
              <span
                className={cn(
                  'absolute inset-0 overflow-hidden',
                  rounded >= i ? 'w-full' : 'w-1/2',
                )}
              >
                <StarIcon className={cn(star, 'fill-brand text-brand')} />
              </span>
            )}
          </span>
        ))}
      </div>
      <span className="text-sm text-muted-foreground">
        <span className="sr-only">{t.product.rated} </span>
        {value.toFixed(1)}
        <span className="sr-only"> {t.product.outOf5}</span>
        {count !== undefined && (
          <span>
            {' '}
            ({number(count)}
            <span className="sr-only"> {t.product.reviews}</span>)
          </span>
        )}
      </span>
    </div>
  );
}
