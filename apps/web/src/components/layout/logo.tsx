import Link from 'next/link';
import { cn } from '@/lib/utils';

/** CSE Keyboards mark: a keycap seen from above, with an offset dished top. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn('size-7', className)}>
      <rect x="1.5" y="1.5" width="29" height="29" rx="8" className="fill-foreground" />
      <rect x="6.5" y="5" width="19" height="17" rx="5" className="fill-background" />
      <rect x="10.5" y="25" width="11" height="2.2" rx="1.1" className="fill-brand" />
      <text
        x="16"
        y="17.4"
        textAnchor="middle"
        className="fill-foreground font-mono text-[7.2px] font-bold tracking-tight"
      >
        CSE
      </text>
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={cn('flex items-center gap-2.5 rounded-md', className)}
      aria-label="CSE Keyboards home"
    >
      <LogoMark />
      <span className="text-[0.95rem] leading-none font-semibold tracking-tight">
        CSE<span className="font-normal text-muted-foreground"> Keyboards</span>
      </span>
    </Link>
  );
}
