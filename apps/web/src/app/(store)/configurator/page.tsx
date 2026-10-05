import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { ConfiguratorBuilder } from '@/components/configurator/configurator-builder';
import { Breadcrumbs } from '@/components/seo/breadcrumbs';
import { createApiClient } from '@/lib/api/client';
import { catalog } from '@/lib/catalog';
import { ConfigurationQuoteSchema } from '@/lib/catalog/schemas';
import { serverApiUrl } from '@/lib/env';

const CONFIGURATOR_SLUG = 'cse-custom';

export const metadata: Metadata = {
  title: 'Keyboard configurator',
  description:
    'Build your own mechanical keyboard: layout, case, switches, plate, keycaps and connection.',
  alternates: { canonical: '/configurator' },
};

export default async function ConfiguratorPage() {
  await connection();
  const configurator = await catalog.getConfigurator(CONFIGURATOR_SLUG);
  if (!configurator) notFound();
  // The initial price comes from the same server-side quote the client uses later.
  const initialQuote = await createApiClient(serverApiUrl())(
    `/configurator/${CONFIGURATOR_SLUG}/quote`,
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
          { name: 'Home', href: '/' },
          { name: 'Configurator', href: '/configurator' },
        ]}
      />
      <header className="mt-6 mb-10 max-w-2xl">
        <p className="eyebrow">Configurator</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">{configurator.name}</h1>
        <p className="mt-3 text-muted-foreground">{configurator.description}</p>
      </header>
      <ConfiguratorBuilder configurator={configurator} initialQuote={initialQuote} />
    </div>
  );
}
