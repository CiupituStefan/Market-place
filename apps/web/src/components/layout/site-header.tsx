import { HeartIcon, UserIcon } from 'lucide-react';
import Link from '@/components/i18n/link';
import { LanguageSwitcher } from '@/components/i18n/language-switcher';
import { Button } from '@/components/ui/button';
import { storeOpen } from '@/lib/env';
import { getI18n } from '@/lib/i18n/server';
import { mainNav } from '@/lib/site';
import { CartLink } from './cart-link';
import { Logo } from './logo';
import { MobileNav } from './mobile-nav';
import { SearchForm } from './search-form';
import { ThemeToggle } from './theme-toggle';

export async function SiteHeader() {
  const { t } = await getI18n();
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70">
      <div className="bg-primary text-primary-foreground">
        <p className="container-page py-2 text-center text-xs tracking-wide">
          {storeOpen ? t.layout.announcement : t.layout.previewAnnouncement}
        </p>
      </div>
      <div className="container-page flex h-16 items-center gap-3">
        <MobileNav />
        <Logo className="mr-4" />
        <nav aria-label={t.layout.mainNav} className="hidden items-center gap-1 lg:flex">
          {mainNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-full px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              {t.layout.nav[item.key]}
            </Link>
          ))}
        </nav>
        <SearchForm className="ml-auto hidden w-full max-w-xs md:block" />
        <div className="ml-auto flex items-center md:ml-2">
          <LanguageSwitcher className="mr-1 hidden sm:flex" />
          <ThemeToggle />
          <Button variant="ghost" size="icon" asChild className="hidden sm:inline-flex">
            <Link href="/wishlist" aria-label={t.layout.wishlist} prefetch={false}>
              <HeartIcon />
            </Link>
          </Button>
          <Button variant="ghost" size="icon" asChild>
            <Link href="/account" aria-label={t.layout.account} prefetch={false}>
              <UserIcon />
            </Link>
          </Button>
          <CartLink />
        </div>
      </div>
    </header>
  );
}
