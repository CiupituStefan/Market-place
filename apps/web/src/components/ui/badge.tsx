import { cva, type VariantProps } from 'class-variance-authority';
import type * as React from 'react';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex w-fit items-center gap-1 rounded-full border px-2.5 py-0.5 font-mono text-[0.68rem] font-medium tracking-wider whitespace-nowrap uppercase',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        brand: 'border-transparent bg-brand text-brand-foreground',
        soft: 'border-transparent bg-brand-soft text-foreground',
        outline: 'bg-background/80 text-foreground backdrop-blur',
        destructive: 'border-transparent bg-destructive text-white',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return (
    <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}
