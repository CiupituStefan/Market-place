import Link from '@/components/i18n/link';
import type { Messages } from '@/lib/i18n/messages';
import { getI18n } from '@/lib/i18n/server';
import { storeOpen } from '@/lib/env';
import { LogoMark } from './logo';

const columns = (t: Messages) => [
  {
    title: t.layout.footer.shop,
    links: [
      { href: '/shop/keyboards', label: t.layout.nav.keyboards },
      { href: '/shop/switches', label: t.layout.nav.switches },
      { href: '/shop/keycaps', label: t.layout.nav.keycaps },
      { href: '/shop/accessories', label: t.layout.nav.accessories },
      { href: '/configurator', label: t.layout.nav.configurator },
      { href: '/shop', label: t.layout.footer.allProducts },
    ],
  },
  {
    title: t.layout.footer.guide,
    links: [
      { href: '/learn/layouts', label: t.learn.topicNames.layouts },
      { href: '/learn/switches', label: t.learn.topicNames.switches },
      { href: '/learn/keycaps', label: t.learn.topicNames.keycaps },
      { href: '/learn/mounting', label: t.learn.topicNames.mounting },
      { href: '/learn/wireless', label: t.learn.topicNames.wireless },
      { href: '/learn/prototype', label: t.learn.topicNames.prototype },
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

/** The close of every page: the shop's map, the source of the guide and the small print. */
export async function SiteFooter() {
  const { t } = await getI18n();
  const copy = t.layout.footer;
  return (
    <footer className="mt-32 px-2 pb-2 sm:px-3 sm:pb-3">
      <div className="panel container-page grid gap-12 py-14 lg:grid-cols-12 lg:py-16">
        <div className="lg:col-span-4">
          <p className="flex items-center gap-2.5 text-lg font-semibold tracking-tight">
            <LogoMark /> CSE Keyboards
          </p>
          <p className="mt-4 max-w-sm text-base text-muted-foreground">{copy.blurb}</p>
        </div>
        <div className="grid grid-cols-2 gap-10 sm:grid-cols-4 lg:col-span-8">
          {columns(t).map((column) => (
            <div key={column.title}>
              <h2 className="text-sm font-semibold">{column.title}</h2>
              <ul className="mt-4 space-y-2.5">
                {column.links.map((link) => (
                  <li key={`${column.title}-${link.href}`}>
                    <Link
                      href={link.href}
                      className="text-[0.9375rem] text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="grid gap-3 border-t border-border pt-6 text-sm text-muted-foreground lg:col-span-12 lg:grid-cols-2">
          <p className="max-w-2xl">{copy.sources}</p>
          <p className="lg:text-right">
            {copy.rights(new Date().getFullYear())}
            {storeOpen ? ` ${copy.payments}` : ''}
          </p>
        </div>
      </div>
    </footer>
  );
}
