import Link from '@/components/i18n/link';
import type { Messages } from '@/lib/i18n/messages';
import { getI18n } from '@/lib/i18n/server';
import { storeOpen } from '@/lib/env';
import { WORLD_IMAGES } from '@/lib/image-credits';

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

/**
 * The close of every page: an inverted field with one invitation, the links, the picture
 * credits and the name, cropped by the bottom edge.
 */
export async function SiteFooter() {
  const { t } = await getI18n();
  const copy = t.layout.footer;
  const credits = Object.values(WORLD_IMAGES);
  return (
    <footer className="mt-32 overflow-hidden bg-primary text-primary-foreground">
      <div className="container-page grid gap-14 pt-24 pb-16 lg:grid-cols-12">
        <div className="lg:col-span-6">
          <h2 className="display text-[clamp(3rem,7vw,6.5rem)] whitespace-pre-line">
            {copy.invitation}
          </h2>
          <Link
            href="/shop/keyboards"
            className="mt-10 inline-flex h-13 items-center bg-brand px-7 text-base font-medium text-brand-foreground transition-transform hover:-translate-y-0.5 active:translate-y-0"
          >
            {copy.invitationAction}
          </Link>
        </div>
        <div className="grid gap-10 sm:grid-cols-3 lg:col-span-6">
          {columns(t).map((column) => (
            <div key={column.title}>
              <h2 className="text-base font-semibold">{column.title}</h2>
              <ul className="mt-4 space-y-3">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-base opacity-80 underline-offset-4 transition-opacity hover:underline hover:opacity-100"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div className="container-page grid gap-3 pb-6 text-sm opacity-75 md:grid-cols-2">
        <p>
          {copy.pictures}{' '}
          {credits.map((credit, index) => (
            <span key={credit.src}>
              <a href={credit.source} className="underline underline-offset-2" rel="noreferrer">
                {credit.title}
              </a>{' '}
              ({credit.creator}, {credit.licence}){index < credits.length - 1 ? '; ' : '.'}
            </span>
          ))}
        </p>
        <p className="md:text-right">
          {copy.rights(new Date().getFullYear())}
          {storeOpen ? ` ${copy.payments}` : ''}
        </p>
      </div>
      <p
        aria-hidden="true"
        className="display container-page translate-y-[28%] text-[clamp(4.5rem,21vw,22rem)] whitespace-nowrap select-none"
      >
        CSE Keyboards
      </p>
    </footer>
  );
}
