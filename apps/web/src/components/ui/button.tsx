import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import type * as React from 'react';
import { cn } from '@/lib/utils';

export const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-none text-[0.9375rem] font-medium whitespace-nowrap transition-[color,background-color,border-color,transform] duration-150 outline-none select-none focus-visible:ring-[3px] focus-visible:ring-ring/50 active:translate-y-px disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/85',
        brand: 'bg-brand text-brand-foreground hover:bg-brand/88',
        // A filled grey surface, not a 1px outline.
        outline: 'bg-secondary text-secondary-foreground hover:bg-accent',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-foreground underline-offset-4 hover:underline',
        destructive: 'bg-destructive text-white hover:bg-destructive/90',
      },
      size: {
        default: 'h-10 px-4',
        sm: 'h-9 px-3 text-sm',
        lg: 'h-13 px-7 text-base',
        icon: 'size-10',
        'icon-sm': 'size-8',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : 'button';
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}
