import type { ReactNode } from 'react';
import { LogoMark } from '@/components/layout/logo';

export function AuthCard({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="container-page flex justify-center py-16">
      <div className="w-full max-w-md rounded-3xl border bg-card p-8 shadow-sm md:p-10">
        <LogoMark className="size-9" />
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        <div className="mt-8">{children}</div>
        {footer && (
          <div className="mt-8 border-t pt-6 text-center text-sm text-muted-foreground">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
