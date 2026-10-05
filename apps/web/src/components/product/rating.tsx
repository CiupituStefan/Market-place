import { StarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RatingProps {
  value: number;
  count?: number;
  className?: string;
  size?: 'sm' | 'md';
}

export function Rating({ value, count, className, size = 'sm' }: RatingProps) {
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
      <span className="text-xs text-muted-foreground">
        <span className="sr-only">Rated </span>
        {value.toFixed(1)}
        <span className="sr-only"> out of 5</span>
        {count !== undefined && (
          <span>
            {' '}
            ({count.toLocaleString('en')}
            <span className="sr-only"> reviews</span>)
          </span>
        )}
      </span>
    </div>
  );
}
