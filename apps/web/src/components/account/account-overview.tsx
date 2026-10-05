'use client';

import { HeartIcon, MapPinIcon, PackageIcon } from 'lucide-react';
import Link from 'next/link';
import { SignOutButton } from '@/components/auth/sign-out-button';
import { EmailPreferences } from './email-preferences';
import { RequireSession } from './require-session';

const links = [
  {
    href: '/account/orders',
    icon: PackageIcon,
    title: 'Orders',
    body: 'Track, return or buy again.',
  },
  { href: '/wishlist', icon: HeartIcon, title: 'Wishlist', body: 'Products you saved for later.' },
  {
    href: '/account',
    icon: MapPinIcon,
    title: 'Addresses',
    body: 'Shipping and billing addresses.',
  },
];

export function AccountOverview() {
  return (
    <RequireSession>
      {(user) => (
        <div className="grid gap-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-muted-foreground">
              Signed in as <span className="font-medium text-foreground">{user.email}</span>
              {!user.emailVerified && (
                <span className="ml-2 text-sm text-destructive">· email not confirmed</span>
              )}
            </p>
            <SignOutButton />
          </div>
          <ul className="grid gap-4 md:grid-cols-3">
            {links.map(({ href, icon: Icon, title, body }) => (
              <li key={title}>
                <Link
                  href={href}
                  className="flex h-full flex-col rounded-2xl border p-6 transition-colors hover:bg-accent"
                >
                  <Icon className="size-5 text-brand" aria-hidden="true" />
                  <span className="mt-4 font-semibold">{title}</span>
                  <span className="mt-1 text-sm text-muted-foreground">{body}</span>
                </Link>
              </li>
            ))}
          </ul>
          <EmailPreferences />
        </div>
      )}
    </RequireSession>
  );
}
