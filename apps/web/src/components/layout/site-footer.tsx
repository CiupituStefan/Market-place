import Link from 'next/link';
import { siteConfig } from '@/lib/site';
import { LogoMark } from './logo';

const columns = [
  {
    title: 'Shop',
    links: [
      { href: '/shop/keyboards', label: 'Keyboards' },
      { href: '/shop/switches', label: 'Switches' },
      { href: '/shop/keycaps', label: 'Keycaps' },
      { href: '/shop/accessories', label: 'Accessories' },
      { href: '/shop', label: 'All products' },
    ],
  },
  {
    title: 'Support',
    links: [
      { href: '/account/orders', label: 'Track an order' },
      { href: '/shipping', label: 'Shipping' },
      { href: '/returns', label: 'Returns & warranty' },
      { href: `mailto:${siteConfig.supportEmail}`, label: 'Contact us' },
    ],
  },
  {
    title: 'Company',
    links: [
      { href: '/about', label: 'About CSE' },
      { href: '/privacy', label: 'Privacy' },
      { href: '/terms', label: 'Terms' },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t bg-secondary/40">
      <div className="container-page grid gap-12 py-16 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="max-w-xs">
          <div className="flex items-center gap-2.5 font-semibold">
            <LogoMark /> CSE Keyboards
          </div>
          <p className="mt-4 text-sm text-muted-foreground">{siteConfig.description}</p>
        </div>
        {columns.map((column) => (
          <div key={column.title}>
            <h2 className="eyebrow text-muted-foreground">{column.title}</h2>
            <ul className="mt-4 space-y-2.5 text-sm">
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t">
        <div className="container-page flex flex-col gap-2 py-6 text-xs text-muted-foreground sm:flex-row sm:justify-between">
          <p>© {new Date().getFullYear()} CSE Keyboards. All rights reserved.</p>
          <p>Secure card payments processed by Stripe. We never store card details.</p>
        </div>
      </div>
    </footer>
  );
}
