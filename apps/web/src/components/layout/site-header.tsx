import { HeartIcon, ShoppingBagIcon, UserIcon } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { mainNav } from '@/lib/site';
import { Logo } from './logo';
import { MobileNav } from './mobile-nav';
import { SearchForm } from './search-form';
import { ThemeToggle } from './theme-toggle';

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70">
      <div className="bg-primary text-primary-foreground">
        <p className="container-page py-2 text-center text-xs tracking-wide">
          Free EU shipping over €99 · 30-day returns · 2-year warranty
        </p>
      </div>
      <div className="container-page flex h-16 items-center gap-3">
        <MobileNav />
        <Logo className="mr-4" />
        <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
          {mainNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-full px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              {item.title}
            </Link>
          ))}
        </nav>
        <SearchForm className="ml-auto hidden w-full max-w-xs md:block" />
        <div className="ml-auto flex items-center md:ml-2">
          <ThemeToggle />
          <Button variant="ghost" size="icon" asChild className="hidden sm:inline-flex">
            <Link href="/wishlist" aria-label="Wishlist" prefetch={false}>
              <HeartIcon />
            </Link>
          </Button>
          <Button variant="ghost" size="icon" asChild>
            <Link href="/account" aria-label="Account" prefetch={false}>
              <UserIcon />
            </Link>
          </Button>
          <Button variant="ghost" size="icon" asChild>
            <Link href="/cart" aria-label="Cart" prefetch={false}>
              <ShoppingBagIcon />
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
