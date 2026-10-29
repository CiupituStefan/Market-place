import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { ConfiguratorBuilder } from '@/components/configurator/configurator-builder';
import { Breadcrumbs } from '@/components/seo/breadcrumbs';
import { createApiClient } from '@/lib/api/client';
import { catalog } from '@/lib/catalog';
import { ConfigurationQuoteSchema } from '@/lib/catalog/schemas';
import { serverApiUrl } from '@/lib/env';
import { getI18n } from '@/lib/i18n/server';
import { localizedAlternates } from '@/lib/seo/alternates';

const CONFIGURATOR_SLUG = 'cse-custom';

export async function generateMetadata(): Promise<Metadata> {
  const { t, locale } = await getI18n();
  return {
    title: t.configurator.metaTitle,
    description: t.configurator.metaDescription,
    alternates: localizedAlternates('/configurator', locale),
  };
}

export default async function ConfiguratorPage() {
  await connection();
  const { t, locale } = await getI18n();
  const configurator = await catalog.getConfigurator(locale, CONFIGURATOR_SLUG);
  if (!configurator) notFound();
  // The initial price comes from the same server-side quote the client uses later.
  const initialQuote = await createApiClient(serverApiUrl())(
    `/configurator/${CONFIGURATOR_SLUG}/quote${locale === 'en' ? '' : `?locale=${locale}`}`,
    {
      method: 'POST',
      body: { selection: configurator.defaultSelection },
      schema: ConfigurationQuoteSchema,
      cache: 'no-store',
    },
  );

  return (
    <div className="container-page py-8">
      <Breadcrumbs
        crumbs={[
          { name: t.shop.home, href: '/' },
          { name: t.configurator.crumb, href: '/configurator' },
        ]}
      />
      <header className="mt-6 mb-10 max-w-2xl">
        <p className="eyebrow">{t.configurator.eyebrow}</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">{configurator.name}</h1>
        <p className="mt-3 text-muted-foreground">{configurator.description}</p>
      </header>
      <ConfiguratorBuilder configurator={configurator} initialQuote={initialQuote} />
    </div>
  );
}
