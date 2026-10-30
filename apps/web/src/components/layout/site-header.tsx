import { HeartIcon, UserIcon } from 'lucide-react';
import Link from '@/components/i18n/link';
import { LanguageSwitcher } from '@/components/i18n/language-switcher';
import { Button } from '@/components/ui/button';
import { storeOpen } from '@/lib/env';
import { getI18n } from '@/lib/i18n/server';
import { mainNav } from '@/lib/site';
import { CartLink } from './cart-link';
import { HeaderFrame } from './header-frame';
import { Logo } from './logo';
import { MobileNav } from './mobile-nav';
import { SearchForm } from './search-form';
import { ThemeToggle } from './theme-toggle';

/** A floating bar: wordmark, the shop's sections and the guide, search and the account controls. */
export async function SiteHeader() {
  const { t } = await getI18n();
  return (
    <header className="sticky top-0 z-40">
      <p className="border-b border-border bg-background px-4 py-1.5 text-center text-sm text-muted-foreground">
        {storeOpen ? t.layout.announcement : t.layout.previewAnnouncement}
      </p>
      <div className="px-2 pt-2 sm:px-3">
        <HeaderFrame>
          <MobileNav />
          <Logo className="mr-4" />
          <nav aria-label={t.layout.mainNav} className="hidden items-center gap-1 lg:flex">
            {mainNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-full px-3 py-2 text-[0.9375rem] font-medium whitespace-nowrap text-foreground/80 transition-colors hover:bg-foreground/[0.07] hover:text-foreground"
              >
                {t.layout.nav[item.key]}
              </Link>
            ))}
          </nav>
          <SearchForm className="ml-auto hidden w-full max-w-xs md:block lg:max-w-[13rem] xl:max-w-xs" />
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
        </HeaderFrame>
      </div>
    </header>
  );
}
