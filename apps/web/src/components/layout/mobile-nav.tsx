'use client';

import { MenuIcon } from 'lucide-react';
import Link from 'next/link';
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
  const [open, setOpen] = useState(false);
  const close = () => {
    setOpen(false);
  };
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
          <MenuIcon />
        </Button>
      </SheetTrigger>
      <SheetContent side="left">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <LogoMark className="size-6" /> CSE Keyboards
          </SheetTitle>
          <SheetDescription className="sr-only">Site navigation</SheetDescription>
        </SheetHeader>
        <div className="px-5" onSubmit={close}>
          <SearchForm />
        </div>
        <nav aria-label="Mobile" className="flex flex-col px-3">
          {mainNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={close}
              className="rounded-lg px-3 py-3 text-lg font-medium hover:bg-accent"
            >
              {item.title}
            </Link>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-1 border-t p-3 text-sm">
          {[
            { href: '/account', label: 'Account' },
            { href: '/account/orders', label: 'Orders' },
            { href: '/wishlist', label: 'Wishlist' },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              prefetch={false}
              onClick={close}
              className="rounded-lg px-3 py-2 hover:bg-accent"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
