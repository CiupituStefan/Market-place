'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogoMark } from '@/components/layout/logo';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { cn } from '@/lib/utils';
import { adminNav } from './admin-nav';

export function AdminSidebar() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === '/admin' ? pathname === href : pathname.startsWith(href);
  return (
    <aside className="flex flex-col border-b bg-card md:sticky md:top-0 md:h-dvh md:border-r md:border-b-0">
      <div className="flex h-16 items-center justify-between gap-2 px-5">
        <Link href="/admin" className="flex items-center gap-2 font-semibold">
          <LogoMark className="size-6" />
          CSE <span className="font-mono text-xs font-normal text-muted-foreground">admin</span>
        </Link>
        <ThemeToggle />
      </div>
      <nav
        aria-label="Admin"
        className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:overflow-visible"
      >
        {adminNav.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            aria-current={isActive(href) ? 'page' : undefined}
            className={cn(
              'flex shrink-0 items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
              isActive(href) && 'bg-accent font-medium text-foreground',
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
            {label}
          </Link>
        ))}
      </nav>
      <div className="mt-auto hidden border-t p-4 md:block">
        <Link href="/" className="text-xs text-muted-foreground hover:text-foreground">
          ← Back to store
        </Link>
      </div>
    </aside>
  );
}
