import Link from '@/components/i18n/link';
import type { Messages } from '@/lib/i18n/messages';
import { getI18n } from '@/lib/i18n/server';
import { LogoMark } from './logo';

const columns = (t: Messages) => [
  {
    title: t.layout.footer.shop,
    links: [
      { href: '/shop/keyboards', label: t.layout.nav.keyboards },
      { href: '/shop/switches', label: t.layout.nav.switches },
      { href: '/shop/keycaps', label: t.layout.nav.keycaps },
      { href: '/shop/accessories', label: t.layout.nav.accessories },
      { href: '/shop', label: t.layout.footer.allProducts },
    ],
  },
  {
    title: t.layout.footer.support,
    links: [
      { href: '/account/orders', label: t.layout.footer.trackOrder },
      { href: '/shipping', label: t.layout.footer.shipping },
      { href: '/returns', label: t.layout.footer.returns },
      // Contact details live on the legal notice (no mailbox exists yet for the domain).
      { href: '/legal', label: t.layout.footer.contact },
    ],
  },
  {
    title: t.layout.footer.company,
    links: [
      { href: '/about', label: t.layout.footer.about },
      { href: '/privacy', label: t.layout.footer.privacy },
      { href: '/terms', label: t.layout.footer.terms },
      { href: '/cookies', label: t.layout.footer.cookies },
      { href: '/legal', label: t.layout.footer.legal },
    ],
  },
];

export async function SiteFooter() {
  const { t } = await getI18n();
  return (
    <footer className="mt-24 border-t bg-secondary/40">
      <div className="container-page grid gap-12 py-16 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="max-w-xs">
          <div className="flex items-center gap-2.5 font-semibold">
            <LogoMark /> CSE Keyboards
          </div>
          <p className="mt-4 text-sm text-muted-foreground">{t.layout.footer.blurb}</p>
        </div>
        {columns(t).map((column) => (
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
          <p>{t.layout.footer.rights(new Date().getFullYear())}</p>
          <p>{t.layout.footer.payments}</p>
        </div>
      </div>
    </footer>
  );
}
