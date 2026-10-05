import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center rounded-3xl border border-dashed px-6 py-16 text-center',
        className,
      )}
    >
      <span className="flex size-12 items-center justify-center rounded-2xl bg-secondary">
        <Icon className="size-5 text-muted-foreground" aria-hidden="true" />
      </span>
      <h2 className="mt-5 text-lg font-semibold">{title}</h2>
      {description && <p className="mt-2 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
