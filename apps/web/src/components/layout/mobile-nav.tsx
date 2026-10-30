'use client';

import { MenuIcon } from 'lucide-react';
import Link from '@/components/i18n/link';
import { LanguageSwitcher } from '@/components/i18n/language-switcher';
import { useI18n } from '@/components/i18n/provider';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { mainNav } from '@/lib/site';
import { LogoMark } from './logo';
import { SearchForm } from './search-form';

export function MobileNav() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const close = () => {
    setOpen(false);
  };
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="xl:hidden" aria-label={t.layout.openMenu}>
          <MenuIcon />
        </Button>
      </SheetTrigger>
      <SheetContent side="left">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <LogoMark className="size-6" /> CSE Keyboards
          </SheetTitle>
          <SheetDescription className="sr-only">{t.layout.menuDescription}</SheetDescription>
        </SheetHeader>
        <div className="px-5" onSubmit={close}>
          <SearchForm />
        </div>
        <nav aria-label={t.layout.menu} className="flex flex-col px-3">
          {mainNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={close}
              className="rounded-lg px-3 py-3 text-lg font-medium hover:bg-accent"
            >
              {t.layout.nav[item.key]}
            </Link>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-1 border-t p-3 text-sm">
          {[
            { href: '/account', label: t.layout.account },
            { href: '/account/orders', label: t.layout.orders },
            { href: '/wishlist', label: t.layout.wishlist },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              prefetch={false}
              onClick={close}
              className="flex min-h-11 items-center rounded-lg px-3 py-2 hover:bg-accent"
            >
              {item.label}
            </Link>
          ))}
          <LanguageSwitcher className="mt-2 self-start" />
        </div>
      </SheetContent>
    </Sheet>
  );
}
