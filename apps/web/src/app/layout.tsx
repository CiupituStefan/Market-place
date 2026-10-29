import { GeistMono } from 'geist/font/mono';
import { GeistSans } from 'geist/font/sans';
import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import type { ReactNode } from 'react';
import { Providers } from '@/components/providers';
import { LOCALE_INFO } from '@/lib/i18n/config';
import { getI18n, getLocale } from '@/lib/i18n/server';
import { localizedAlternates } from '@/lib/seo/alternates';
import { siteConfig } from '@/lib/site';
import './globals.css';

export async function generateMetadata(): Promise<Metadata> {
  const { locale, t } = await getI18n();
  const description = t.layout.footer.blurb;
  const tagline = t.meta.tagline;
  return {
    metadataBase: new URL(siteConfig.url),
    title: {
      default: `${siteConfig.name} — ${tagline}`,
      template: `%s · ${siteConfig.name}`,
    },
    description,
    applicationName: siteConfig.name,
    alternates: localizedAlternates('/', locale),
    openGraph: {
      type: 'website',
      siteName: siteConfig.name,
      locale: LOCALE_INFO[locale].openGraph,
      url: '/',
      title: siteConfig.name,
      description,
    },
    twitter: {
      card: 'summary_large_image',
      title: siteConfig.name,
      description,
    },
    robots: { index: true, follow: true },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#faf8f4' },
    { media: '(prefers-color-scheme: dark)', color: '#16171b' },
  ],
};

/**
 * Reads the CSP nonce and the language set by the proxy. Reading request headers makes every
 * page render per request: a nonce cannot be baked into static HTML. Data stays cached (fetch
 * revalidation).
 */
export default async function RootLayout({ children }: { children: ReactNode }) {
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  const locale = await getLocale();
  return (
    // next-themes sets the theme class before hydration, hence suppressHydrationWarning.
    <html
      lang={LOCALE_INFO[locale].htmlLang}
      suppressHydrationWarning
      className={`${GeistSans.variable} ${GeistMono.variable}`}
    >
      <body className="min-h-dvh font-sans">
        <Providers nonce={nonce} locale={locale}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
